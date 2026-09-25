export type Category = "image" | "video" | "audio" | "document";

export interface Action {
  file_name: string;
  file_size: number;
  from: string;
  to: string | null;
  file_type: string;
  category: Category | null;
  file: File;
  is_converted: boolean;
  is_converting: boolean;
  is_error: boolean;
  url?: string;
  output?: string;
}
