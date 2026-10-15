import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Image, Wand2, Upload, Download, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase as supabaseClient } from "@/integrations/supabase/client";
const supabase = supabaseClient as any;
export const ImageEditor = () => {
  const {
    toast
  } = useToast();
  const [prompt, setPrompt] = useState("");
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const handleGenerateImage = async () => {
    if (!prompt.trim()) {
      toast({
        title: "Prompt required",
        description: "Please enter a description for the image",
        variant: "destructive"
      });
      return;
    }
    setIsGenerating(true);
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke("generate-image", {
        body: {
          prompt
        }
      });
      if (error) throw error;
      setGeneratedImage(data.imageUrl);
      toast({
        title: "Image generated!",
        description: "Your AI-generated image is ready"
      });
    } catch (error) {
      toast({
        title: "Generation failed",
        description: "Failed to generate image. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = e => {
        setUploadedImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };
  const base64ToBlob = (base64: string) => {
    const parts = base64.split(';base64,');
    const contentType = parts[0].split(':')[1];
    const raw = window.atob(parts[1]);
    const rawLength = raw.length;
    const uInt8Array = new Uint8Array(rawLength);
    for (let i = 0; i < rawLength; ++i) {
      uInt8Array[i] = raw.charCodeAt(i);
    }
    return new Blob([uInt8Array], {
      type: contentType
    });
  };
  const handleDownload = (imageUrl: string) => {
    const link = document.createElement("a");
    link.href = imageUrl;
    link.download = `ai-generated-${Date.now()}.png`;
    link.click();
  };
  const handleSaveToFiles = async (imageUrl: string) => {
    try {
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Sign in to save generated images.");
      const userId = user.id;

      // Convert base64 to blob
      const blob = base64ToBlob(imageUrl);
      const fileName = `ai-generated-${Date.now()}.png`;
      const filePath = `${userId}/${fileName}`;

      // Upload to storage
      const {
        error: uploadError
      } = await supabase.storage.from("user-files").upload(filePath, blob, {
        contentType: 'image/png'
      });
      if (uploadError) throw uploadError;

      // Save metadata to database in /generated-images folder
      const {
        error: dbError
      } = await supabase.from("files").insert({
        user_id: userId,
        name: fileName,
        size: blob.size,
        mime_type: 'image/png',
        storage_path: filePath,
        folder_path: '/generated-images'
      });
      if (dbError) throw dbError;
      toast({
        title: "Saved to Files!",
        description: "Image saved to 'generated-images' folder"
      });
    } catch (error: any) {
      toast({
        title: "Failed to save",
        description: error.message,
        variant: "destructive"
      });
    }
  };
  const handleDownloadAndSave = async (imageUrl: string) => {
    handleDownload(imageUrl);
    await handleSaveToFiles(imageUrl);
  };
  return <Card className="h-full bg-gray-950">
      <CardHeader className="bg-slate-950">
        <CardTitle className="flex items-center gap-2 text-slate-100">
          <Image className="h-5 w-5 text-primary" />
          AI Image Editor
        </CardTitle>
        <CardDescription>
          Generate and edit images with AI-powered tools
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 bg-slate-950">
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-50">Upload Image</label>
          <div className="flex items-center gap-2">
            <Input type="file" accept="image/*" onChange={handleImageUpload} className="flex-1" />
            <Button variant="outline" size="icon">
              <Upload className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {uploadedImage && <div className="rounded-lg border bg-muted/50 p-4">
            <img src={uploadedImage} alt="Uploaded" className="w-full h-48 object-contain rounded" />
          </div>}

        <div className="space-y-2">
          <label className="font-medium text-sm text-slate-50">AI Image Generation</label>
          <Textarea placeholder="Describe the image you want to generate..." value={prompt} onChange={e => setPrompt(e.target.value)} rows={3} />
          <Button onClick={handleGenerateImage} disabled={isGenerating} className="w-full text-slate-950 bg-slate-300 hover:bg-slate-200">
            <Wand2 className="h-4 w-4 mr-2" />
            {isGenerating ? "Generating..." : "Generate Image"}
          </Button>
        </div>

        {generatedImage && <div className="space-y-2">
            <div className="rounded-lg border bg-muted/50 p-4">
              <img src={generatedImage} alt="Generated" className="w-full h-64 object-contain rounded" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => handleDownload(generatedImage)} className="flex-1">
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
              <Button onClick={() => handleDownloadAndSave(generatedImage)} className="flex-1">
                <Save className="h-4 w-4 mr-2" />
                Save & Download
              </Button>
            </div>
          </div>}
      </CardContent>
    </Card>;
};