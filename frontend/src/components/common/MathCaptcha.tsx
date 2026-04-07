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
    <div className="space-y-1.5">
      <label className="text-[11px] font-black text-slate-400 ml-1 uppercase tracking-[0.2em] flex justify-between">
        <span>Vérification de sécurité</span>
        {userAnswer && (
          userAnswer !== '' && parseInt(userAnswer, 10) === num1 + num2
            ? <span className="text-green-500">Valide</span>
            : <span className="text-red-500">Incorrect</span>
        )}
      </label>
      <div className={`relative group/captcha w-full bg-slate-50/80 focus-within:bg-white rounded-full py-2 px-2 pl-4 transition-all border shadow-sm flex items-center justify-between ${
          userAnswer && parseInt(userAnswer, 10) === num1 + num2 
          ? 'border-green-300 ring-2 ring-green-500/10' 
          : userAnswer 
          ? 'border-red-300 ring-4 ring-red-500/10' 
          : 'border-slate-100 hover:border-slate-300 focus-within:border-primary-500 focus-within:ring-4 focus-within:ring-primary-500/10'
      }`}>
        <div className="flex items-center space-x-3">
          <div className="bg-white px-2 py-0.5 rounded-xl shadow-sm border border-slate-100/60 flex items-center justify-center">
            {captchaDataUrl ? (
               <img src={captchaDataUrl} alt="Captcha" className="h-[34px] w-[110px] object-contain pointer-events-none select-none rounded" />
            ) : (
              <div className="h-[34px] w-[110px] bg-slate-100 animate-pulse rounded" />
            )}
          </div>
          <button
            type="button"
            onClick={generateCaptcha}
            className="text-slate-400 hover:text-primary-600 transition-transform p-1 hover:rotate-180 duration-500"
            title="Nouveau calcul"
          >
            <RefreshCw size={18} />
          </button>
        </div>
        <div className="pr-1">
          <input
            type="number"
            value={userAnswer}
            onChange={handleChange}
            className="block w-[80px] bg-slate-100/50 focus:bg-white rounded-full py-2 px-3 border-0 transition-colors outline-none text-center font-black text-slate-700 placeholder:text-slate-400 focus:ring-0 shadow-inner"
            placeholder="Total ?"
            required
          />
        </div>
      </div>
    </div>
  );
}
