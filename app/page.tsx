import Dropzone from "@/components/dropzone";

export default function Home() {
  return (
    <div className="relative flex flex-col gap-16 pb-8">
      <div className="relative z-10 space-y-6">
        <h1 className="text-4xl font-bold text-center sm:text-5xl">
          Free Unlimited File Converter
        </h1>
        <p className="max-w-3xl mx-auto text-lg text-center text-muted-foreground">
          Convert your files easily with ConvertX. Support for images, audio, video, 
          and documents - all for free, right in your browser.
        </p>
      </div>
      
      <div className="relative z-0">
        <Dropzone />
      </div>
    </div>
  );
}