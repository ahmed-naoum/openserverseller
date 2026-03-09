export default function Analytics() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytique B2B</h1>
          <p className="mt-1 text-sm text-gray-500">Comprenez la performance de vos produits et vos revenus.</p>
        </div>
        <select className="input max-w-xs font-medium bg-white">
          <option>Derniers 7 jours</option>
          <option>Ce mois-ci</option>
          <option>Cette année</option>
          <option>Tout le temps</option>
        </select>
      </div>

      {/* Top Value Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5">
          <p className="text-sm text-gray-500 font-medium">Revenus Générés</p>
          <h3 className="text-2xl font-bold text-gray-900 mt-1">45,300 MAD</h3>
          <p className="text-xs text-green-600 mt-2 font-medium flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
            +12% vs période précedente
          </p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-gray-500 font-medium">Unités Vendues</p>
          <h3 className="text-2xl font-bold text-gray-900 mt-1">320 Unités</h3>
          <p className="text-xs text-green-600 mt-2 font-medium flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
            +5% vs période précedente
          </p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-gray-500 font-medium">Taux d'Acceptation</p>
          <h3 className="text-2xl font-bold text-gray-900 mt-1">94%</h3>
          <p className="text-xs text-red-600 mt-2 font-medium flex items-center gap-1">
             <svg className="w-3 h-3 transform rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
            -2% vs période précedente
          </p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-gray-500 font-medium">Vendeurs Actifs (sur vos rep.)</p>
          <h3 className="text-2xl font-bold text-gray-900 mt-1">45 Vendeurs</h3>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6 min-h-[300px] flex flex-col">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Évolution des Ventes</h2>
          <div className="flex-1 flex items-center justify-center bg-gray-50 rounded-lg border border-gray-100 border-dashed">
            <p className="text-gray-400 text-sm">Graphique des tendances (Intégration Bientôt)</p>
          </div>
        </div>

        <div className="card p-6 min-h-[300px]">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Top Produits (Volume)</h2>
          <div className="space-y-4">
            {/* Mock Top List */}
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <span className="w-6 text-center font-bold text-gray-400">#{i}</span>
                  <div>
                    <h4 className="font-semibold text-gray-900 text-sm">Produit Populaire {i}</h4>
                    <p className="text-xs text-gray-500">Ref: PROD-00{i}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="block font-bold text-grosseller-600 text-sm">{150 - (i * 20)} Ventes</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
