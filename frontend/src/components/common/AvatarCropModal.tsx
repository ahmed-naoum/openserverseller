import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { X, ZoomIn, ZoomOut, RotateCw, Check, Loader2 } from 'lucide-react';

interface AvatarCropModalProps {
  imageSrc: string;
  onClose: () => void;
  onSave: (croppedBlob: Blob) => Promise<void>;
}

interface CroppedArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

async function getCroppedImg(imageSrc: string, pixelCrop: CroppedArea): Promise<Blob> {
  const image = new Image();
  image.crossOrigin = 'anonymous';
  
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = reject;
    image.src = imageSrc;
  });

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas to blob failed'));
      },
      'image/jpeg',
      0.95
    );
  });
}

export default function AvatarCropModal({ imageSrc, onClose, onSave }: AvatarCropModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CroppedArea | null>(null);
  const [saving, setSaving] = useState(false);

  const onCropComplete = useCallback((_croppedArea: any, croppedAreaPixels: CroppedArea) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleSave = async () => {
    if (!croppedAreaPixels) return;
    setSaving(true);
    try {
      const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
      await onSave(croppedBlob);
    } catch (error) {
      console.error('Crop failed:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-gray-50/50">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Recadrer votre photo</h3>
            <p className="text-sm text-gray-500 mt-0.5">Ajustez le cadrage de votre photo de profil</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-400 hover:text-gray-600"
          >
            <X size={20} />
          </button>
        </div>
        
        {/* Crop Area */}
        <div className="relative w-full" style={{ height: 360 }}>
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onRotationChange={setRotation}
            onCropComplete={onCropComplete}
            style={{
              containerStyle: {
                background: '#111827',
              },
              cropAreaStyle: {
                border: '3px solid rgba(255,255,255,0.8)',
                boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)',
              },
            }}
          />
        </div>

        {/* Controls */}
        <div className="px-6 py-5 space-y-5 bg-white">
          {/* Zoom Slider */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setZoom(Math.max(1, zoom - 0.1))}
              className="p-2 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors text-gray-600"
            >
              <ZoomOut size={18} />
            </button>
            <div className="flex-1">
              <input
                type="range"
                min={1}
                max={3}
                step={0.05}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
              />
            </div>
            <button
              onClick={() => setZoom(Math.min(3, zoom + 0.1))}
              className="p-2 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors text-gray-600"
            >
              <ZoomIn size={18} />
            </button>
            <div className="w-px h-8 bg-gray-200" />
            <button
              onClick={() => setRotation((rotation + 90) % 360)}
              className="p-2 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors text-gray-600"
              title="Rotation"
            >
              <RotateCw size={18} />
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold transition-colors disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2.5 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white rounded-xl font-bold shadow-lg shadow-primary-500/25 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Sauvegarde...
                </>
              ) : (
                <>
                  <Check size={18} />
                  Enregistrer
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
