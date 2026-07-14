# Plan: Composant Vidéo avec Cloudinary

## 1. Objectif
Ajouter un composant "Vidéo" dans le Constructeur de Page (SiteBuilder) qui permet de :
- Téléverser une vidéo directement sur Cloudinary.
- Récupérer l'URL du CDN Cloudinary.
- Afficher la vidéo sur la page avec des options (Lecture automatique, en boucle, contrôles).

## 2. Ce qu'il me manque (TRÈS IMPORTANT)
Pour que Cloudinary fonctionne, l'API nécessite 3 éléments :
1. **API Key** : `686749435119774` (Fourni)
2. **API Secret** : `Z7DsFVEtIpa_kQfBDHquBQM9gr8` (Fourni)
3. **Cloud Name** : ⚠️ **NON FOURNI** ⚠️

**👉 Veuillez me donner votre "Cloud Name" Cloudinary (ex: `dqxyz123`) pour que je puisse commencer l'intégration.** Vous pouvez le trouver sur le tableau de bord de votre compte Cloudinary.

## 3. Étapes d'implémentation
Dès que vous me donnez le **Cloud Name**, voici ce que je vais faire :

### Backend
1. Installation du SDK `cloudinary` (`npm install cloudinary`).
2. Création d'une nouvelle route API `/api/upload/cloudinary-video`.
3. Cette route prendra le fichier vidéo, l'enverra à Cloudinary en toute sécurité (avec vos clés), et retournera l'URL CDN.

### Frontend
1. **SiteBuilder.tsx** :
   - Ajout du bouton "Vidéo" dans la barre latérale gauche (sous "Composants").
   - Ajout d'une zone de téléversement (Upload) dans les propriétés à droite quand le composant vidéo est sélectionné.
2. **BlockRenderer.tsx** :
   - Ajout de la logique pour afficher le lecteur `<video>` HTML5 avec l'URL Cloudinary reçue.
3. **api.ts** :
   - Ajout de la fonction pour appeler la nouvelle route d'upload vidéo.

---
**En attente de votre Cloud Name pour démarrer !**
