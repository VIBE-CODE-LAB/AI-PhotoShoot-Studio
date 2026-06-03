import React, { useCallback, useRef, useState } from 'react';

interface ImageUploaderProps {
  label: string;
  hint?: string;
  image: string | null;
  onImageUpload: (base64: string) => void;
  onClear: () => void;
  variant?: 'default' | 'compact';
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  label,
  hint,
  image,
  onImageUpload,
  onClear,
  variant = 'default',
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      onImageUpload(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  if (variant === 'compact') {
    const isUploaded = Boolean(image);
    return (
      <div
        className={`dB-slot${isUploaded ? ' up' : ''}${isDragging ? ' drag' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
      >
        <span className="dB-s-i">{isUploaded ? '✓' : '+'}</span>
        <span className="dB-s-n">{label}</span>
        <span className="dB-s-t">{isUploaded ? 'Added' : hint || 'Required'}</span>
        {isUploaded && (
          <button
            type="button"
            className="dB-slot-clear"
            onClick={(event) => {
              event.stopPropagation();
              onClear();
            }}
          >
            Remove
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          className="dB-slot-input"
          accept="image/*"
          onChange={handleFileChange}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 w-full">
      <span className="text-sm font-semibold text-brand-800 uppercase tracking-wide">{label}</span>

      {image ? (
        <div className="relative group w-full aspect-[3/4] rounded-xl overflow-hidden shadow-sm border border-brand-200">
          <img src={image} alt={label} className="w-full h-full object-cover" />
          <button
            onClick={onClear}
            className="absolute top-2 right-2 bg-white/90 text-brand-900 p-2 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 hover:text-red-600"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" /><path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
      ) : (
        <label
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={
            `flex flex-col items-center justify-center w-full aspect-[3/4] ` +
            `border-2 border-dashed rounded-xl cursor-pointer transition-colors duration-200 ` +
            `${isDragging ? 'border-brand-500 bg-brand-50' : 'border-brand-300 bg-white hover:bg-brand-50'}`
          }
        >
          <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
            <svg className="w-8 h-8 mb-4 text-brand-400" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16">
              <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2" />
            </svg>
            <p className="mb-2 text-sm text-brand-600"><span className="font-semibold">Click to upload</span> or drag and drop</p>
            <p className="text-xs text-brand-400">JPG or PNG</p>
          </div>
          <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
        </label>
      )}
    </div>
  );
};