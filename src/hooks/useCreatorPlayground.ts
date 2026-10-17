/**
 * useCreatorPlayground — Hook for managing the Creator Data Layer + Page Registry.
 * 
 * Provides CRUD operations for business content objects, page management,
 * and funnel orchestration. All mutations flow through SiteBundle patch ops.
 */

import { useState, useCallback, useMemo } from "react";
import { nanoid } from "nanoid";
import type { CreatorData, CreatorProduct, CreatorService, CreatorForm, CreatorOverlay, CreatorCollection, CreatorTestimonial, CreatorFaqItem, CreatorGalleryItem, CreatorTeamMember, CreatorBusinessInfo, CreatorComponentInstance } from "@/types/creatorData";
import { createEmptyCreatorData } from "@/types/creatorData";
import type { PageRegistry, BuilderPage, FunnelGraph, FunnelStep, BuilderPageType, FunnelRole } from "@/types/pageRegistry";
import { createEmptyPageRegistry, createBuilderPage, createFunnelGraph, getNavPages, getFunnelPages, resolveNextFunnelPage } from "@/types/pageRegistry";
import { hydratePlaygroundFromVFS, mergeHydrationResult, type HydrationResult } from "@/services/playgroundHydrator";
import { resolveSnapshot } from "@/services/snapshotProjector";
import type { VirtualNode } from "@/hooks/useVirtualFileSystem";

// ============================================================================
// Hook State
// ============================================================================

export interface UseCreatorPlaygroundReturn {
  // State
  creatorData: CreatorData;
  pageRegistry: PageRegistry;
  hydrateCanonicalState: (state: { creatorData?: CreatorData; pageRegistry?: PageRegistry }) => void;

  // Page CRUD
  addPage: (title: string, path: string, pageType: BuilderPageType, options?: Partial<BuilderPage>) => BuilderPage;
  updatePage: (pageId: string, updates: Partial<BuilderPage>) => void;
  removePage: (pageId: string) => void;
  setHomePage: (pageId: string) => void;
  duplicatePage: (pageId: string) => BuilderPage | null;
  reorderPages: (pageIds: string[]) => void;
  getNavPages: () => BuilderPage[];
  getAllPages: () => BuilderPage[];

  // Funnel CRUD
  addFunnel: (name: string, pageIds?: string[]) => FunnelGraph;
  updateFunnel: (funnelId: string, updates: Partial<FunnelGraph>) => void;
  removeFunnel: (funnelId: string) => void;
  addFunnelStep: (funnelId: string, pageId: string, role: FunnelRole) => void;
  removeFunnelStep: (funnelId: string, stepId: string) => void;
  reorderFunnelSteps: (funnelId: string, stepIds: string[]) => void;
  resolveNextPage: (currentPageId: string) => BuilderPage | null;

  // Product CRUD
  addProduct: (product: Omit<CreatorProduct, "productId" | "sortOrder">) => CreatorProduct;
  updateProduct: (productId: string, updates: Partial<CreatorProduct>) => void;
  removeProduct: (productId: string) => void;

  // Service CRUD
  addService: (service: Omit<CreatorService, "serviceId" | "sortOrder">) => CreatorService;
  updateService: (serviceId: string, updates: Partial<CreatorService>) => void;
  removeService: (serviceId: string) => void;

  // Form CRUD
  addForm: (form: Omit<CreatorForm, "formId" | "sortOrder">) => CreatorForm;
  updateForm: (formId: string, updates: Partial<CreatorForm>) => void;
  removeForm: (formId: string) => void;

  // Component Instance CRUD
  addComponentInstance: (instance: Omit<CreatorComponentInstance, "instanceId"> & { instanceId?: string }) => CreatorComponentInstance;
  updateComponentInstance: (instanceId: string, updates: Partial<CreatorComponentInstance>) => void;
  removeComponentInstance: (instanceId: string) => void;

  // Business info
  updateBusinessInfo: (updates: Partial<CreatorBusinessInfo>) => void;

  // Collection CRUD
  addCollection: (collection: Omit<CreatorCollection, "collectionId" | "sortOrder">) => CreatorCollection;
  updateCollection: (collectionId: string, updates: Partial<CreatorCollection>) => void;
  removeCollection: (collectionId: string) => void;

  // Hydration — auto-populate from VFS
  hydrateFromVFS: (nodes: VirtualNode[], sandpackFiles: Record<string, string>) => HydrationResult;
  lastHydration: HydrationResult | null;

  // Dirty flag
  isDirty: boolean;
}

// ============================================================================
// Hook
// ============================================================================

export function useCreatorPlayground(
  initialCreatorData?: CreatorData,
  initialPageRegistry?: PageRegistry,
): UseCreatorPlaygroundReturn {
  const [creatorData, setCreatorData] = useState<CreatorData>(
    initialCreatorData || createEmptyCreatorData()
  );
  const [pageRegistry, setPageRegistry] = useState<PageRegistry>(
    initialPageRegistry || createEmptyPageRegistry()
  );
  const [isDirty, setIsDirty] = useState(false);
  const [lastHydration, setLastHydration] = useState<HydrationResult | null>(null);

  // --------------------------------------------------------------------------
  // Page CRUD
  // --------------------------------------------------------------------------

  const addPage = useCallback((
    title: string, path: string, pageType: BuilderPageType, options?: Partial<BuilderPage>
  ): BuilderPage => {
    const pageId = `page_${nanoid(8)}`;
    const navOrder = Object.keys(pageRegistry.pages).length;
    const page = createBuilderPage(pageId, title, path, pageType, { navOrder, ...options });

    setPageRegistry(prev => {
      const isFirst = Object.keys(prev.pages).length === 0;
      return {
        ...prev,
        pages: { ...prev.pages, [pageId]: page },
        homePageId: isFirst ? pageId : prev.homePageId,
        version: prev.version + 1,
      };
    });
    setIsDirty(true);
    return page;
  }, [pageRegistry.pages]);

  const updatePage = useCallback((pageId: string, updates: Partial<BuilderPage>) => {
    setPageRegistry(prev => {
      const existing = prev.pages[pageId];
      if (!existing) return prev;
      return {
        ...prev,
        pages: {
          ...prev.pages,
          [pageId]: { ...existing, ...updates, updatedAt: new Date().toISOString() },
        },
        version: prev.version + 1,
      };
    });
    setIsDirty(true);
  }, []);

  const removePage = useCallback((pageId: string) => {
    setPageRegistry(prev => {
      const { [pageId]: _, ...rest } = prev.pages;
      // Remove from any funnels
      const funnels = { ...prev.funnels };
      for (const [fid, funnel] of Object.entries(funnels)) {
        funnels[fid] = {
          ...funnel,
          steps: funnel.steps.filter(s => s.pageId !== pageId),
        };
      }
      return {
        ...prev,
        pages: rest,
        funnels,
        homePageId: prev.homePageId === pageId ? Object.keys(rest)[0] || "" : prev.homePageId,
        version: prev.version + 1,
      };
    });
    setIsDirty(true);
  }, []);

  const setHomePage = useCallback((pageId: string) => {
    setPageRegistry(prev => ({
      ...prev,
      homePageId: pageId,
      pages: Object.fromEntries(
        Object.entries(prev.pages).map(([id, p]) => [id, { ...p, isHome: id === pageId }])
      ),
      version: prev.version + 1,
    }));
    setIsDirty(true);
  }, []);

  const duplicatePage = useCallback((pageId: string): BuilderPage | null => {
    const existing = pageRegistry.pages[pageId];
    if (!existing) return null;
    const newId = `page_${nanoid(8)}`;
    const newPage: BuilderPage = {
      ...existing,
      pageId: newId,
      title: `${existing.title} (Copy)`,
      path: `${existing.path}-copy`,
      isHome: false,
      funnelId: undefined,
      funnelIds: [],
      funnelRole: undefined,
      routeState: "draft",
      publishedStatus: "unpublished",
      previewLastSyncedAt: undefined,
      previewThumbnailUrl: undefined,
      previewError: undefined,
      navOrder: Object.keys(pageRegistry.pages).length,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setPageRegistry(prev => ({
      ...prev,
      pages: { ...prev.pages, [newId]: newPage },
      version: prev.version + 1,
    }));
    setIsDirty(true);
    return newPage;
  }, [pageRegistry.pages]);

  const reorderPages = useCallback((pageIds: string[]) => {
    setPageRegistry(prev => {
      const pages = { ...prev.pages };
      pageIds.forEach((id, i) => {
        if (pages[id]) pages[id] = { ...pages[id], navOrder: i };
      });
      return { ...prev, pages, version: prev.version + 1 };
    });
    setIsDirty(true);
  }, []);

  const getNavPagesHelper = useCallback(() => getNavPages(pageRegistry), [pageRegistry]);
  const getAllPagesHelper = useCallback(() => Object.values(pageRegistry.pages), [pageRegistry]);

  // --------------------------------------------------------------------------
  // Funnel CRUD
  // --------------------------------------------------------------------------

  const addFunnel = useCallback((name: string, pageIds: string[] = []): FunnelGraph => {
    const funnelId = `funnel_${nanoid(8)}`;
    const steps: FunnelStep[] = pageIds.map((pid, i) => ({
      stepId: `step_${nanoid(6)}`,
      pageId: pid,
      role: i === 0 ? "entry" as FunnelRole : i === pageIds.length - 1 ? "thankyou" as FunnelRole : "offer" as FunnelRole,
      nextStepId: null, // linked below
      sortOrder: i,
    }));
    // Link steps
    steps.forEach((step, i) => {
      step.nextStepId = i < steps.length - 1 ? steps[i + 1].stepId : null;
    });
    const funnel = createFunnelGraph(funnelId, name, steps);

    // Tag pages with funnelId/role
    setPageRegistry(prev => {
      const pages = { ...prev.pages };
      steps.forEach(step => {
        if (pages[step.pageId]) {
          const funnelIds = new Set(pages[step.pageId].funnelIds || []);
          funnelIds.add(funnelId);
          pages[step.pageId] = {
            ...pages[step.pageId],
            funnelId,
            funnelIds: Array.from(funnelIds),
            funnelRole: step.role,
          };
        }
      });
      return {
        ...prev,
        pages,
        funnels: { ...prev.funnels, [funnelId]: funnel },
        version: prev.version + 1,
      };
    });
    setIsDirty(true);
    return funnel;
  }, []);

  const updateFunnel = useCallback((funnelId: string, updates: Partial<FunnelGraph>) => {
    setPageRegistry(prev => {
      const existing = prev.funnels[funnelId];
      if (!existing) return prev;
      return {
        ...prev,
        funnels: {
          ...prev.funnels,
          [funnelId]: { ...existing, ...updates, updatedAt: new Date().toISOString() },
        },
        version: prev.version + 1,
      };
    });
    setIsDirty(true);
  }, []);

  const removeFunnel = useCallback((funnelId: string) => {
    setPageRegistry(prev => {
      const { [funnelId]: _, ...rest } = prev.funnels;
      // Clear funnel references from pages
      const pages = { ...prev.pages };
      for (const [pid, page] of Object.entries(pages)) {
        if (page.funnelId === funnelId || page.funnelIds?.includes(funnelId)) {
          const nextFunnelIds = (page.funnelIds || []).filter((id) => id !== funnelId);
          pages[pid] = {
            ...page,
            funnelId: nextFunnelIds[0],
            funnelIds: nextFunnelIds,
            funnelRole: page.funnelId === funnelId ? undefined : page.funnelRole,
          };
        }
      }
      return { ...prev, pages, funnels: rest, version: prev.version + 1 };
    });
    setIsDirty(true);
  }, []);

  const addFunnelStep = useCallback((funnelId: string, pageId: string, role: FunnelRole) => {
    setPageRegistry(prev => {
      const funnel = prev.funnels[funnelId];
      if (!funnel) return prev;
      const stepId = `step_${nanoid(6)}`;
      const lastStep = funnel.steps[funnel.steps.length - 1];
      const newStep: FunnelStep = {
        stepId,
        pageId,
        role,
        nextStepId: null,
        sortOrder: funnel.steps.length,
      };
      // Link previous last step to new step
      const steps = [...funnel.steps];
      if (lastStep) {
        const lastIdx = steps.findIndex(s => s.stepId === lastStep.stepId);
        steps[lastIdx] = { ...lastStep, nextStepId: stepId };
      }
      steps.push(newStep);

      const pages = { ...prev.pages };
      if (pages[pageId]) {
        const funnelIds = new Set(pages[pageId].funnelIds || []);
        funnelIds.add(funnelId);
        pages[pageId] = {
          ...pages[pageId],
          funnelId,
          funnelIds: Array.from(funnelIds),
          funnelRole: role,
        };
      }

      return {
        ...prev,
        pages,
        funnels: {
          ...prev.funnels,
          [funnelId]: { ...funnel, steps, updatedAt: new Date().toISOString() },
        },
        version: prev.version + 1,
      };
    });
    setIsDirty(true);
  }, []);

  const removeFunnelStep = useCallback((funnelId: string, stepId: string) => {
    setPageRegistry(prev => {
      const funnel = prev.funnels[funnelId];
      if (!funnel) return prev;
      const stepIdx = funnel.steps.findIndex(s => s.stepId === stepId);
      if (stepIdx === -1) return prev;

      const removedStep = funnel.steps[stepIdx];
      const steps = funnel.steps.filter(s => s.stepId !== stepId);
      // Relink: previous step now points to next
      if (stepIdx > 0 && steps[stepIdx - 1]) {
        steps[stepIdx - 1] = {
          ...steps[stepIdx - 1],
          nextStepId: removedStep.nextStepId,
        };
      }

      const pages = { ...prev.pages };
      if (pages[removedStep.pageId]) {
        const nextFunnelIds = (pages[removedStep.pageId].funnelIds || []).filter((id) => id !== funnelId);
        pages[removedStep.pageId] = {
          ...pages[removedStep.pageId],
          funnelId: nextFunnelIds[0],
          funnelIds: nextFunnelIds,
          funnelRole: undefined,
        };
      }

      return {
        ...prev,
        pages,
        funnels: {
          ...prev.funnels,
          [funnelId]: {
            ...funnel,
            steps,
            entryStepId: steps[0]?.stepId || "",
            updatedAt: new Date().toISOString(),
          },
        },
        version: prev.version + 1,
      };
    });
    setIsDirty(true);
  }, []);

  const reorderFunnelSteps = useCallback((funnelId: string, stepIds: string[]) => {
    setPageRegistry(prev => {
      const funnel = prev.funnels[funnelId];
      if (!funnel) return prev;
      const steps = stepIds
        .map(id => funnel.steps.find(s => s.stepId === id))
        .filter(Boolean) as FunnelStep[];
      // Re-link chain
      steps.forEach((step, i) => {
        step.sortOrder = i;
        step.nextStepId = i < steps.length - 1 ? steps[i + 1].stepId : null;
      });
      return {
        ...prev,
        funnels: {
          ...prev.funnels,
          [funnelId]: { ...funnel, steps, entryStepId: steps[0]?.stepId || "", updatedAt: new Date().toISOString() },
        },
        version: prev.version + 1,
      };
    });
    setIsDirty(true);
  }, []);

  const resolveNext = useCallback((currentPageId: string) => {
    return resolveNextFunnelPage(pageRegistry, currentPageId);
  }, [pageRegistry]);

  // --------------------------------------------------------------------------
  // Content CRUD (generic helper)
  // --------------------------------------------------------------------------

  const patchCreatorData = useCallback(<K extends keyof CreatorData>(
    key: K, value: CreatorData[K]
  ) => {
    setCreatorData(prev => ({ ...prev, [key]: value }));
    setIsDirty(true);
  }, []);

  // Products
  const addProduct = useCallback((product: Omit<CreatorProduct, "productId" | "sortOrder">): CreatorProduct => {
    const p: CreatorProduct = { ...product, productId: `prod_${nanoid(8)}`, sortOrder: Object.keys(creatorData.products).length };
    patchCreatorData("products", { ...creatorData.products, [p.productId]: p });
    return p;
  }, [creatorData.products, patchCreatorData]);

  const updateProduct = useCallback((productId: string, updates: Partial<CreatorProduct>) => {
    const existing = creatorData.products[productId];
    if (!existing) return;
    patchCreatorData("products", { ...creatorData.products, [productId]: { ...existing, ...updates } });
  }, [creatorData.products, patchCreatorData]);

  const removeProduct = useCallback((productId: string) => {
    const { [productId]: _, ...rest } = creatorData.products;
    patchCreatorData("products", rest);
  }, [creatorData.products, patchCreatorData]);

  // Services
  const addService = useCallback((service: Omit<CreatorService, "serviceId" | "sortOrder">): CreatorService => {
    const s: CreatorService = { ...service, serviceId: `svc_${nanoid(8)}`, sortOrder: Object.keys(creatorData.services).length };
    patchCreatorData("services", { ...creatorData.services, [s.serviceId]: s });
    return s;
  }, [creatorData.services, patchCreatorData]);

  const updateService = useCallback((serviceId: string, updates: Partial<CreatorService>) => {
    const existing = creatorData.services[serviceId];
    if (!existing) return;
    patchCreatorData("services", { ...creatorData.services, [serviceId]: { ...existing, ...updates } });
  }, [creatorData.services, patchCreatorData]);

  const removeService = useCallback((serviceId: string) => {
    const { [serviceId]: _, ...rest } = creatorData.services;
    patchCreatorData("services", rest);
  }, [creatorData.services, patchCreatorData]);

  // Forms
  const addForm = useCallback((form: Omit<CreatorForm, "formId" | "sortOrder">): CreatorForm => {
    const f: CreatorForm = { ...form, formId: `form_${nanoid(8)}`, sortOrder: Object.keys(creatorData.forms).length };
    patchCreatorData("forms", { ...creatorData.forms, [f.formId]: f });
    return f;
  }, [creatorData.forms, patchCreatorData]);

  const updateForm = useCallback((formId: string, updates: Partial<CreatorForm>) => {
    const existing = creatorData.forms[formId];
    if (!existing) return;
    patchCreatorData("forms", { ...creatorData.forms, [formId]: { ...existing, ...updates } });
  }, [creatorData.forms, patchCreatorData]);

  const removeForm = useCallback((formId: string) => {
    const { [formId]: _, ...rest } = creatorData.forms;
    patchCreatorData("forms", rest);
  }, [creatorData.forms, patchCreatorData]);

  // Component Instances
  const addComponentInstance = useCallback((
    instance: Omit<CreatorComponentInstance, "instanceId"> & { instanceId?: string }
  ): CreatorComponentInstance => {
    const nextInstance: CreatorComponentInstance = {
      ...instance,
      instanceId: instance.instanceId || `cmp_${nanoid(8)}`,
    };
    patchCreatorData("componentInstances", {
      ...creatorData.componentInstances,
      [nextInstance.instanceId]: nextInstance,
    });
    return nextInstance;
  }, [creatorData.componentInstances, patchCreatorData]);

  const updateComponentInstance = useCallback((instanceId: string, updates: Partial<CreatorComponentInstance>) => {
    const existing = creatorData.componentInstances[instanceId];
    if (!existing) return;
    patchCreatorData("componentInstances", {
      ...creatorData.componentInstances,
      [instanceId]: { ...existing, ...updates },
    });
  }, [creatorData.componentInstances, patchCreatorData]);

  const removeComponentInstance = useCallback((instanceId: string) => {
    const { [instanceId]: _, ...rest } = creatorData.componentInstances;
    patchCreatorData("componentInstances", rest);
  }, [creatorData.componentInstances, patchCreatorData]);

  // Business Info
  const updateBusinessInfo = useCallback((updates: Partial<CreatorBusinessInfo>) => {
    setCreatorData(prev => ({
      ...prev,
      businessInfo: { ...prev.businessInfo, ...updates },
    }));
    setIsDirty(true);
  }, []);

  // Collections
  const addCollection = useCallback((col: Omit<CreatorCollection, "collectionId" | "sortOrder">): CreatorCollection => {
    const c: CreatorCollection = { ...col, collectionId: `col_${nanoid(8)}`, sortOrder: Object.keys(creatorData.collections).length };
    patchCreatorData("collections", { ...creatorData.collections, [c.collectionId]: c });
    return c;
  }, [creatorData.collections, patchCreatorData]);

  const updateCollection = useCallback((collectionId: string, updates: Partial<CreatorCollection>) => {
    const existing = creatorData.collections[collectionId];
    if (!existing) return;
    patchCreatorData("collections", { ...creatorData.collections, [collectionId]: { ...existing, ...updates } });
  }, [creatorData.collections, patchCreatorData]);

  const removeCollection = useCallback((collectionId: string) => {
    const { [collectionId]: _, ...rest } = creatorData.collections;
    patchCreatorData("collections", rest);
  }, [creatorData.collections, patchCreatorData]);

  // --------------------------------------------------------------------------
  // VFS Hydration
  // --------------------------------------------------------------------------

  const hydrateFromVFS = useCallback((nodes: VirtualNode[], sandpackFiles: Record<string, string>): HydrationResult => {
    const snapshot = resolveSnapshot(sandpackFiles).snapshot;
    if (snapshot?.pageRegistry && snapshot.creatorData) {
      const canonicalData = snapshot.creatorData;
      const result: HydrationResult = {
        pageRegistry: snapshot.pageRegistry,
        creatorData: canonicalData,
        funnelAutoWired: false,
        stats: {
          pagesDetected: Object.keys(snapshot.pageRegistry.pages).length,
          productsExtracted: Object.keys(canonicalData.products).length,
          servicesExtracted: Object.keys(canonicalData.services).length,
          testimonialsExtracted: Object.keys(canonicalData.testimonials).length,
          faqsExtracted: Object.keys(canonicalData.faqs).length,
          componentsExtracted: Object.keys(canonicalData.componentInstances ?? {}).length,
          funnelSteps: Object.values(snapshot.pageRegistry.funnels).reduce((total, funnel) => total + funnel.steps.length, 0),
        },
      };
      setPageRegistry(result.pageRegistry);
      setCreatorData(result.creatorData);
      setLastHydration(result);
      setIsDirty(false);
      return result;
    }
    const result = hydratePlaygroundFromVFS(nodes, sandpackFiles);
    
    // Merge with existing state (idempotent)
    const merged = mergeHydrationResult({ pageRegistry, creatorData }, result);
    setPageRegistry(merged.pageRegistry);
    setCreatorData(merged.creatorData);
    setLastHydration(result);
    // Inference is a compatibility read, not a user mutation or a save request.
    // Retain any already pending explicit edits; hydration itself stays clean.
    
    console.log('[useCreatorPlayground] Hydrated from VFS:', result.stats);
    return result;
  }, [pageRegistry, creatorData]);

  const hydrateCanonicalState = useCallback((state: { creatorData?: CreatorData; pageRegistry?: PageRegistry }) => {
    if (state.pageRegistry) {
      setPageRegistry(state.pageRegistry);
    }
    if (state.creatorData) {
      setCreatorData(state.creatorData);
    }
    setIsDirty(false);
  }, []);

  return {
    creatorData,
    pageRegistry,
    hydrateCanonicalState,
    addPage, updatePage, removePage, setHomePage, duplicatePage, reorderPages,
    getNavPages: getNavPagesHelper, getAllPages: getAllPagesHelper,
    addFunnel, updateFunnel, removeFunnel, addFunnelStep, removeFunnelStep, reorderFunnelSteps,
    resolveNextPage: resolveNext,
    addProduct, updateProduct, removeProduct,
    addService, updateService, removeService,
    addForm, updateForm, removeForm,
    addComponentInstance, updateComponentInstance, removeComponentInstance,
    updateBusinessInfo,
    addCollection, updateCollection, removeCollection,
    hydrateFromVFS,
    lastHydration,
    isDirty,
  };
}
