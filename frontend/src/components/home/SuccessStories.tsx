import { motion } from 'framer-motion';
import { Star, TrendingUp, Users } from 'lucide-react';

export default function SuccessStories() {
  const stories = [
    {
      name: "Amina, 24 ans",
      role: "Vendeuse E-commerce",
      image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=800&auto=format&fit=crop&q=80",
      stats: "50,000 MAD / mois",
      story: "« J'ai lancé ma marque 'AminaGlow' sans acheter un seul produit en avance. J'ai pris un sérum du catalogue SILACOD, j'ai mis mon logo dessus, et j'ai lancé des pubs TikTok. SILACOD s'occupe de la confirmation et de l'envoi. Je ne gère que les ventes. C'est magique. »",
      icon: <TrendingUp className="w-5 h-5" />
    },
    {
      name: "Youssef VLOG",
      role: "Influenceur (+80k VIP)",
      image: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=800&auto=format&fit=crop&q=80",
      stats: "15,000 MAD Passif",
      story: "« Mes abonnés me demandaient toujours ce que j'utilisais pour ma peau. J'ai pris un lien d'affiliation d'un produit SILACOD, je l'ai mis en bio Instagram, et l'argent tombe tout seul sur mon Wallet chaque semaine. Meilleur programme. »",
      icon: <Users className="w-5 h-5" />
    }
  ];

  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8 bg-white relative overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <span className="text-primary-600 font-bold tracking-wider uppercase text-sm mb-4 block">Histoires de Succès</span>
          <h2 className="text-4xl lg:text-5xl font-extrabold text-gray-900 mb-6">Ils ont changé leur vie avec SILACOD</h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">De vrais partenaires qui génèrent de vrais revenus en utilisant notre infrastructure Dropshipping et Affiliation.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
          {stories.map((story, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.2 }}
              className="bg-gray-50 rounded-[2.5rem] p-8 lg:p-12 relative group hover:-translate-y-2 transition-transform duration-500 shadow-xl shadow-gray-200/50"
            >
              <div className="flex flex-col sm:flex-row gap-8 items-start">
                <div className="relative shrink-0">
                  <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-lg z-10 relative">
                    <img src={story.image} alt={story.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="absolute -bottom-2 -right-2 bg-gradient-to-r from-accent-500 to-pink-500 text-white p-2 rounded-full shadow-lg z-20">
                     {story.icon}
                  </div>
                </div>
                
                <div>
                  <div className="flex gap-1 mb-2">
                    {[...Array(5)].map((_, j) => <Star key={j} className="w-5 h-5 text-yellow-400 fill-amber-400" />)}
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-1">{story.name}</h3>
                  <p className="text-primary-600 font-semibold mb-4">{story.role}</p>
                  <p className="text-gray-700 text-lg leading-relaxed italic mb-6">
                    {story.story}
                  </p>
                  <div className="inline-flex items-center gap-2 bg-green-100 text-green-700 px-4 py-2 rounded-xl font-bold">
                    💰 Gains: {story.stats}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
