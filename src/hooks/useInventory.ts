import { useState, useRef, useCallback, useEffect } from 'react';
import { Product } from '../types';

export function useInventory(searchQuery: string) {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedDept, setSelectedDept] = useState('');
  const [departments, setDepartments] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isFetchingImages, setIsFetchingImages] = useState(false);
  const [fetchProgress, setFetchProgress] = useState({ current: 0, total: 0, found: 0 });
  const [uploadMessage, setUploadMessage] = useState<{type: 'success'|'error', text: string} | null>(null);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cancelFetchRef = useRef(false);

  // Edit state
  const [editingSku, setEditingSku] = useState<string | null>(null);
  const [editLocation, setEditLocation] = useState('');
  const [editImageUrl, setEditImageUrl] = useState('');
  const [editAltUpcs, setEditAltUpcs] = useState('');

  // Image Selector State
  const [imageSelectorSku, setImageSelectorSku] = useState<string | null>(null);
  const [imageCandidates, setImageCandidates] = useState<string[]>([]);
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(false);

  // Lazy loading state
  const [visibleCount, setVisibleCount] = useState(20);

  const handleScroll = useCallback(() => {
    if (window.innerHeight + document.documentElement.scrollTop + 200 >= document.documentElement.offsetHeight) {
      setVisibleCount(prev => prev + 20);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  const fetchProducts = async (query = '', dept = '') => {
    try {
      let url = `/api/products?q=${encodeURIComponent(query)}`;
      if (dept) url += `&dept=${encodeURIComponent(dept)}`;
      
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
        setVisibleCount(20);
        
        if (!query && !dept && departments.length === 0) {
          const depts = Array.from(new Set(data.map((p: Product) => p.depname))).filter(Boolean) as string[];
          setDepartments(depts.sort());
        }
      }
    } catch (error) {
      console.error('Failed to fetch products', error);
    }
  };

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchProducts(searchQuery, selectedDept);
    }, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, selectedDept]);


  const handleFileUpload = async (file: File) => {
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setIsUploading(true);
    setUploadMessage(null);

    try {
      const res = await fetch('/api/products/upload', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setUploadMessage({ type: 'success', text: `Successfully updated ${data.count} items from CSV.` });
        fetchProducts(searchQuery);
      } else {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Upload failed');
      }
    } catch (error: any) {
      setUploadMessage({ type: 'error', text: error.message || 'Failed to upload CSV file. Please check the format.' });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const BATCH_SIZE = 30;

  const stopFetchImages = () => {
    cancelFetchRef.current = true;
  };

  const batchFetchImages = async () => {
    const productsWithoutImages = products.filter(p => !p.image_url);
    if (productsWithoutImages.length === 0) {
      setUploadMessage({ type: 'success', text: 'All products already have images!' });
      return;
    }

    cancelFetchRef.current = false;
    setIsFetchingImages(true);
    setFetchProgress({ current: 0, total: productsWithoutImages.length, found: 0 });
    setUploadMessage(null);

    let successCount = 0;
    let processedCount = 0;

    for (let i = 0; i < productsWithoutImages.length; i += BATCH_SIZE) {
      if (cancelFetchRef.current) break;

      const batch = productsWithoutImages.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map(async (product) => {
          const res = await fetch(`/api/products/${product.sku}/fetch-image`, { method: 'POST' });
          if (res.ok) {
            const data = await res.json();
            if (data.image_url) {
              setProducts(prev => prev.map(p =>
                p.sku === product.sku ? { ...p, image_url: data.image_url } : p
              ));
              return true;
            }
          }
          return false;
        })
      );

      const batchFound = results.filter(r => r.status === 'fulfilled' && r.value === true).length;
      successCount += batchFound;
      processedCount += batch.length;

      setFetchProgress({
        current: processedCount,
        total: productsWithoutImages.length,
        found: successCount,
      });

      if (!cancelFetchRef.current && i + BATCH_SIZE < productsWithoutImages.length) {
        await new Promise(resolve => setTimeout(resolve, 800));
      }
    }

    const stopped = cancelFetchRef.current;
    cancelFetchRef.current = false;
    setIsFetchingImages(false);

    if (stopped) {
      const remaining = productsWithoutImages.length - processedCount;
      setUploadMessage({
        type: 'success',
        text: `Stopped after ${processedCount} products — found ${successCount} images. ${remaining} remaining.`,
      });
    } else {
      setUploadMessage({
        type: 'success',
        text: `Done! Found images for ${successCount} out of ${productsWithoutImages.length} products.`,
      });
    }
  };

  const startEditing = (product: Product) => {
    setEditingSku(product.sku);
    setEditLocation(product.location || '');
    setEditImageUrl(product.image_url || '');
    setEditAltUpcs(product.alt_upcs || '');
  };

  const cancelEditing = () => {
    setEditingSku(null);
    setEditLocation('');
    setEditImageUrl('');
    setEditAltUpcs('');
  };

  const saveEdits = async (sku: string) => {
    try {
      const res = await fetch(`/api/products/${sku}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location: editLocation, image_url: editImageUrl, alt_upcs: editAltUpcs }),
      });

      if (res.ok) {
        setProducts(products.map(p => 
          p.sku === sku ? { ...p, location: editLocation, image_url: editImageUrl, alt_upcs: editAltUpcs } : p
        ));
        setEditingSku(null);
      }
    } catch (error) {
      console.error('Failed to save edits', error);
    }
  };

  const openImageSelector = async (sku: string) => {
    setImageSelectorSku(sku);
    setIsLoadingCandidates(true);
    setImageCandidates([]);
    try {
      const res = await fetch(`/api/products/${sku}/image-candidates`);
      if (res.ok) {
        const data = await res.json();
        setImageCandidates(data.candidates || []);
      }
    } catch (err) {
      console.error('Failed to fetch candidates', err);
    } finally {
      setIsLoadingCandidates(false);
    }
  };

  const selectImage = async (sku: string, url: string) => {
    const product = products.find(p => p.sku === sku);
    if (!product) return;
    
    try {
      const res = await fetch(`/api/products/${sku}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location: product.location || '', image_url: url }),
      });

      if (res.ok) {
        setProducts(products.map(p => 
          p.sku === sku ? { ...p, image_url: url } : p
        ));
        setImageSelectorSku(null);
      }
    } catch (error) {
      console.error('Failed to save selected image', error);
    }
  };

  return {
    products, setProducts,
    selectedDept, setSelectedDept, departments,
    isUploading, isFetchingImages,
    fetchProgress,
    uploadMessage, setUploadMessage,
    fileInputRef, handleFileUpload,
    stopFetchImages, batchFetchImages,
    editingSku, editLocation, setEditLocation, editImageUrl, setEditImageUrl, editAltUpcs, setEditAltUpcs,
    startEditing, cancelEditing, saveEdits,
    imageSelectorSku, setImageSelectorSku, imageCandidates, isLoadingCandidates,
    openImageSelector, selectImage,
    visibleCount, showAdminPanel, setShowAdminPanel
  };
}
