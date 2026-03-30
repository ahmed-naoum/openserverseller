import { useState } from 'react';
import { motion } from 'framer-motion';

export default function ProfitSimulator() {
  const [salesPerDay, setSalesPerDay] = useState(10);
  const [sellingPrice, setSellingPrice] = useState(250);

  // Estimates: Product costs ~40MAD, Ads ~50MAD, Delivery ~40MAD, SILACOD Margin ~15%.
  // Simplified realistic formula for dropshipping the platform provides:
  const costPerProduct = 45;
  const deliveryAndConfirm = 40;
  const adCostEstimate = 40;
  const silacodFee = sellingPrice * 0.15;
  
  const netProfitPerSale = sellingPrice - (costPerProduct + deliveryAndConfirm + adCostEstimate + silacodFee);
  const netProfitPerMonth = netProfitPerSale * salesPerDay * 30;

  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-gray-900 to-gray-800 font-inter text-white overflow-hidden relative">
      <div className="absolute top-0 right-0 w-96 h-96 bg-primary-500/10 rounded-full blur-[100px]"></div>
      
      <div className="max-w-5xl mx-auto relative z-10">
        <div className="text-center mb-16">
          <span className="text-accent-400 font-bold tracking-wider uppercase text-sm mb-4 block">Simulateur de Revenus</span>
          <h2 className="text-4xl lg:text-5xl font-extrabold mb-6">Visualisez vos futurs profits.</h2>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">Calculez exactement ce que vous allez gagner en vendant vos produits White Label avec SILACOD.</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[3rem] p-8 lg:p-12 shadow-2xl">
          
          <div className="space-y-10">
            <div>
              <div className="flex justify-between mb-4">
                <label className="font-bold text-lg text-gray-200">Ventes par jour</label>
                <span className="font-extrabold text-2xl text-accent-400">{salesPerDay} ventes</span>
              </div>
              <input 
                type="range" 
                min="1" 
                max="100" 
                value={salesPerDay}
                onChange={(e) => setSalesPerDay(Number(e.target.value))}
                className="w-full h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-accent-500"
              />
            </div>

            <div>
              <div className="flex justify-between mb-4">
                <label className="font-bold text-lg text-gray-200">A quel prix allez-vous vendre ?</label>
                <span className="font-extrabold text-2xl text-primary-400">{sellingPrice} MAD</span>
              </div>
              <input 
                type="range" 
                min="99" 
                max="500" 
                step="10"
                value={sellingPrice}
                onChange={(e) => setSellingPrice(Number(e.target.value))}
                className="w-full h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary-500"
              />
            </div>
            
            <div className="p-6 bg-black/30 rounded-2xl border border-white/5 space-y-3">
              <div className="flex justify-between text-sm text-gray-400">
                <span>Coût produit estimé</span><span>-{costPerProduct} MAD</span>
              </div>
              <div className="flex justify-between text-sm text-gray-400">
                <span>Confirme & Livraison</span><span>-{deliveryAndConfirm} MAD</span>
              </div>
              <div className="flex justify-between text-sm text-gray-400">
                <span>Pub Facebook (Estimée)</span><span>-{adCostEstimate} MAD</span>
              </div>
              <div className="flex justify-between text-sm text-gray-400">
                <span>Frais Logistiques (15%)</span><span>-{Math.round(silacodFee)} MAD</span>
              </div>
              <div className="h-px bg-white/10 my-2"></div>
              <div className="flex justify-between font-bold text-accent-400">
                <span>Bénéfice Net par vente</span><span>{Math.round(netProfitPerSale > 0 ? netProfitPerSale : 0)} MAD</span>
              </div>
            </div>
          </div>

          <motion.div 
            key={netProfitPerMonth}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex flex-col items-center justify-center text-center bg-gradient-to-br from-primary-600 to-accent-600 rounded-3xl p-10 shadow-2xl shadow-primary-500/20"
          >
             <span className="text-primary-100 font-bold uppercase tracking-widest text-sm mb-4">Bénéfice Net par Mois</span>
             <div className="text-6xl md:text-7xl font-black text-white mb-2 leading-tight">
               {netProfitPerMonth > 0 ? netProfitPerMonth.toLocaleString() : 0} <br/> <span className="text-3xl text-primary-200">MAD</span>
             </div>
             <p className="text-white/80 mt-6 text-lg font-medium">Argent 100% propre dans votre poche, après tous les frais.</p>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
