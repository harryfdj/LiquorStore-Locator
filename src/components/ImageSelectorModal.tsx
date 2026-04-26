import React from 'react';
import { X, Search, Image as ImageIcon, ExternalLink, Clipboard } from 'lucide-react';
import { proxyUrl } from '../lib/images';
import { Product } from '../types';

interface ImageSelectorModalProps {
  imageSelectorSku: string;
  imageCandidates: string[];
  isLoadingCandidates: boolean;
  products: Product[];
  setImageSelectorSku: (sku: string | null) => void;
  selectImage: (sku: string, url: string) => void;
}

export const ImageSelectorModal: React.FC<ImageSelectorModalProps> = ({
  imageSelectorSku, imageCandidates, isLoadingCandidates, products,
  setImageSelectorSku, selectImage
}) => {
  const [manualUrl, setManualUrl] = React.useState('');

  React.useEffect(() => {
    if (imageSelectorSku) setManualUrl('');
  }, [imageSelectorSku]);

  if (!imageSelectorSku) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div role="dialog" aria-modal="true" aria-label="Select product image" className="surface-card p-6 max-w-5xl w-full shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-4 sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-xl font-bold">Select Better Image</h2>
            <p className="text-sm text-stone-500 mt-1">
              Searching for: <span className="font-semibold text-stone-700">{products.find(p => p.sku === imageSelectorSku)?.name}</span>
            </p>
          </div>
          <button onClick={() => setImageSelectorSku(null)} className="text-stone-400 hover:text-stone-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="mb-4 flex flex-col sm:flex-row gap-2">
          <div className="flex-1 relative">
            <input 
              type="text" 
              placeholder="Paste image URL here and press Enter..." 
              value={manualUrl}
              onChange={(e) => setManualUrl(e.target.value)}
              className="control-input w-full pl-3 pr-10 py-2 text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (manualUrl.trim()) selectImage(imageSelectorSku, manualUrl.trim());
                }
              }}
            />
            <ImageIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          </div>
          <button
            onClick={async () => {
              try {
                const text = await navigator.clipboard.readText();
                if (text) {
                  setManualUrl(text.trim());
                  selectImage(imageSelectorSku, text.trim());
                }
              } catch (err) {
                console.error('Failed to read clipboard', err);
                alert('Could not read clipboard. Please paste manually.');
              }
            }}
            className="bg-lime-100 hover:bg-lime-200 text-slate-950 px-4 py-2 rounded-2xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <Clipboard className="w-4 h-4" />
            Paste & Use
          </button>
          <a 
            href={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent((products.find(p => p.sku === imageSelectorSku)?.name || '') + ' bottle')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary px-4 py-2 text-sm flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <Search className="w-4 h-4" />
            Search Google
            <ExternalLink className="w-3 h-3 ml-1 opacity-50" />
          </a>
        </div>
        
        {isLoadingCandidates ? (
          <div className="flex-1 flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
          </div>
        ) : (
          <div className="columns-2 sm:columns-3 md:columns-4 lg:columns-5 gap-4 overflow-y-auto p-2">
            {imageCandidates.map((url, idx) => (
              <div 
                key={idx} 
                className="break-inside-avoid mb-4 border-2 border-transparent hover:border-lime-300 rounded-2xl overflow-hidden cursor-pointer bg-slate-100 flex items-center justify-center group relative"
                onClick={() => selectImage(imageSelectorSku, url)}
              >
                <img 
                  src={proxyUrl(url)} 
                  alt="Candidate" 
                  className="w-full h-auto object-contain"
                  loading="lazy"
                  onError={(e) => {
                    (e.target as HTMLImageElement).parentElement!.style.display = 'none';
                  }}
                />
                <div className="absolute inset-0 bg-lime-300/0 group-hover:bg-lime-300/20 transition-colors flex items-center justify-center">
                  <span className="opacity-0 group-hover:opacity-100 bg-slate-950 text-white text-xs font-semibold px-2 py-1 rounded-lg transition-opacity shadow-sm">
                    Select
                  </span>
                </div>
              </div>
            ))}
            {imageCandidates.length === 0 && (
              <div className="col-span-full text-center text-stone-500 py-8">No alternative images found.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
