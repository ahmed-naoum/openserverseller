import React, { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

interface MathCaptchaProps {
  onValidate: (isValid: boolean) => void;
}

export function MathCaptcha({ onValidate }: MathCaptchaProps) {
  const [num1, setNum1] = useState(0);
  const [num2, setNum2] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [captchaDataUrl, setCaptchaDataUrl] = useState('');

  const generateCaptchaImage = (n1: number, n2: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = 120;
    canvas.height = 40;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background
    ctx.fillStyle = '#f9fafb';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Add some noise (lines) to make it harder to OCR
    for (let i = 0; i < 5; i++) {
      ctx.strokeStyle = `rgba(${Math.random() * 255},${Math.random() * 255},${Math.random() * 255},0.3)`;
      ctx.beginPath();
      ctx.moveTo(Math.random() * canvas.width, Math.random() * canvas.height);
      ctx.lineTo(Math.random() * canvas.width, Math.random() * canvas.height);
      ctx.stroke();
    }

    // Text
    ctx.font = 'bold 20px Arial';
    ctx.fillStyle = '#374151';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    ctx.translate(canvas.width / 2, canvas.height / 2);
    // Slight rotation
    const angle = (Math.random() - 0.5) * 0.3;
    ctx.rotate(angle);
    ctx.fillText(`${n1} + ${n2} = ?`, 0, 0);
    ctx.rotate(-angle);
    ctx.translate(-canvas.width / 2, -canvas.height / 2);
    
    // Add some dots noise
    for (let i = 0; i < 30; i++) {
      ctx.fillStyle = `rgba(${Math.random() * 255},${Math.random() * 255},${Math.random() * 255},0.4)`;
      ctx.beginPath();
      ctx.arc(
        Math.random() * canvas.width, 
        Math.random() * canvas.height, 
        Math.random() * 1.5, 
        0, Math.PI * 2
      );
      ctx.fill();
    }

    setCaptchaDataUrl(canvas.toDataURL('image/png'));
  };

  const generateCaptcha = () => {
    const n1 = Math.floor(Math.random() * 10) + 1;
    const n2 = Math.floor(Math.random() * 10) + 1;
    setNum1(n1);
    setNum2(n2);
    setUserAnswer('');
    onValidate(false);
    generateCaptchaImage(n1, n2);
  };

  useEffect(() => {
    generateCaptcha();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setUserAnswer(val);
    if (val !== '' && parseInt(val, 10) === num1 + num2) {
      onValidate(true);
    } else {
      onValidate(false);
    }
  };

  return (
    <div className="flex items-center space-x-3 bg-gray-50 p-3 rounded-xl border border-gray-200 justify-between">
      <div className="flex items-center space-x-3">
        <div className="bg-white px-2 py-1 rounded shadow-sm border border-gray-100 flex items-center justify-center">
          {captchaDataUrl ? (
             <img src={captchaDataUrl} alt="Captcha" className="h-[40px] w-[120px] object-contain pointer-events-none select-none" />
          ) : (
            <div className="h-[40px] w-[120px] bg-gray-100 animate-pulse rounded" />
          )}
        </div>
        <button
          type="button"
          onClick={generateCaptcha}
          className="text-gray-400 hover:text-primary-600 transition-colors p-1"
          title="Nouveau calcul"
        >
          <RefreshCw size={18} />
        </button>
      </div>
      <div>
        <input
          type="number"
          value={userAnswer}
          onChange={handleChange}
          className="block w-20 border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500 sm:text-sm p-2 text-center shadow-sm"
          placeholder="Total"
          required
        />
      </div>
    </div>
  );
}
