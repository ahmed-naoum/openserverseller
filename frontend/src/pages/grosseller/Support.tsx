export default function Support() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Centre d'Assistance</h1>
          <p className="mt-1 text-sm text-gray-500">Contactez notre équipe de support dédiée aux Grossellers.</p>
        </div>
        <button className="btn bg-grosseller-600 hover:bg-grosseller-700 text-white shadow-sm flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Nouveau Ticket
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="card p-5 border border-gray-100 hover:border-grosseller-300 transition-colors cursor-pointer">
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 text-xs font-bold rounded bg-yellow-100 text-yellow-700">En cours</span>
                <span className="text-sm text-gray-400 font-mono">#TCK-0092</span>
              </div>
              <span className="text-xs text-gray-500">Il y a 2 heures</span>
            </div>
            <h3 className="font-bold text-gray-900">Problème d'approbation de produit</h3>
            <p className="text-sm text-gray-600 mt-1 line-clamp-2">Bonjour, j'ai soumis 3 nouveaux produits hier mais ils sont toujours bloqués en statut "En attente". Pouvez-vous vérifier ?</p>
          </div>

          <div className="card p-5 border border-gray-100 opacity-60">
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 text-xs font-bold rounded bg-green-100 text-green-700">Résolu</span>
                <span className="text-sm text-gray-400 font-mono">#TCK-0045</span>
              </div>
              <span className="text-xs text-gray-500">12 Mars 2026</span>
            </div>
            <h3 className="font-bold text-gray-900">Demande de modification RIB</h3>
            <p className="text-sm text-gray-600 mt-1 line-clamp-2">Le changement a été effectué avec succès par notre équipe financière.</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card p-6 bg-grosseller-50 border-none">
            <h3 className="font-bold text-grosseller-900 mb-2">Besoin d'aide urgente ?</h3>
            <p className="text-sm text-grosseller-700 mb-4">Notre équipe est disponible du lundi au vendredi de 9h à 18h.</p>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm text-grosseller-800">
                <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                +212 5 00 00 00 00
              </div>
              <div className="flex items-center gap-3 text-sm text-grosseller-800">
                <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                grosseller@silacod.com
              </div>
            </div>
          </div>
          
          <div className="card p-6">
            <h3 className="font-bold text-gray-900 mb-4">FAQ Rapide</h3>
            <div className="space-y-4">
              <details className="text-sm group">
                <summary className="font-medium text-gray-700 cursor-pointer hover:text-grosseller-600">Combien de temps prend l'approbation ?</summary>
                <p className="mt-2 text-gray-500">Généralement entre 24h et 48h ouvrables selon le volume de demandes.</p>
              </details>
              <details className="text-sm group">
                <summary className="font-medium text-gray-700 cursor-pointer hover:text-grosseller-600">Comment sont gérés les retours ?</summary>
                <p className="mt-2 text-gray-500">Les produits non livrés ou retournés sont réintégrés dans votre inventaire virtuel automatiquement.</p>
              </details>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
