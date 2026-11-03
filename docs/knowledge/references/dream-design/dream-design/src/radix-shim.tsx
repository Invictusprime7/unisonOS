
import React from 'react';

const passthrough = (tag = 'div') => React.forwardRef(({ children, ...props }, ref) =>
  React.createElement(tag, { ...props, ref }, children)
);

export const Root = passthrough();
export const Trigger = passthrough('button');
export const Content = passthrough();
export const Portal = ({ children }) => React.createElement(React.Fragment, null, children);
export const Overlay = passthrough();
export const Title = passthrough('h2');
export const Description = passthrough('p');
export const Close = passthrough('button');
export const Item = passthrough();
export const ItemText = passthrough('span');
export const ItemIndicator = passthrough('span');
export const Group = passthrough();
export const Label = passthrough('label');
export const Separator = passthrough();
export const Viewport = passthrough();
export const Scrollbar = passthrough();
export const Thumb = passthrough();
export const Icon = passthrough('span');
export const Arrow = passthrough();
export const Value = passthrough('span');
export const Indicator = passthrough('span');
export const Toggle = passthrough('button');
export const ToggleGroup = Root;
export const ToggleGroupItem = Trigger;
export const List = passthrough();
export const Link = passthrough('a');
export const Collection = passthrough();
export const CollectionItem = passthrough();
export const AspectRatio = passthrough();
export const Image = passthrough('img');
export const Fallback = passthrough('span');
export const Provider = ({ children }) => React.createElement(React.Fragment, null, children);
export const ToastProvider = Provider;
export const ToastViewport = Viewport;
export const Toast = Root;
export const ToastTitle = Title;
export const ToastDescription = Description;
export const ToastAction = Trigger;
export const ToastClose = Close;
export const createSlot = () => Slot;
export const Slottable = ({ children }) => React.createElement(React.Fragment, null, children);
export const Slot = React.forwardRef(({ children, ...props }, ref) => {
  const child = React.Children.toArray(children).find(React.isValidElement);
  return child
    ? React.cloneElement(child, { ...props, ref })
    : React.createElement('span', { ...props, ref }, children);
});
export const createContextScope = () => [() => [Provider, () => ({})], () => ({})];
export const createCollection = () => [{ Provider, Slot, ItemSlot: Item }, () => [], () => ({})];
export const unstable_createCollection = createCollection;
export const createPopperScope = () => () => ({});
export const createMenuScope = () => () => ({});
export const createDialogScope = () => () => ({});
export const createSelectScope = () => () => ({});
export const createTooltipScope = () => () => ({});
export const createTabsScope = () => () => ({});
export const createAccordionScope = () => () => ({});
export const useControllableState = ({ defaultProp, prop, onChange }) => {
  const [value, setValue] = React.useState(prop === undefined ? defaultProp : prop);
  const set = (next) => { const resolved = typeof next === 'function' ? next(value) : next; setValue(resolved); onChange?.(resolved); };
  return [prop === undefined ? value : prop, set];
};
export const useComposedRefs = (...refs) => (node) => refs.forEach((ref) => {
  if (typeof ref === 'function') ref(node);
  else if (ref) ref.current = node;
});
