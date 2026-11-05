# SCI Pialgo

Espace privé de la SCI familiale : connexion par code à usage unique envoyé par e-mail, puis accès aux documents stockés dans la base Notion « Documents ».

Stack : Next.js 16 (App Router), Tailwind CSS 4, Motion, pdf.js. Composant de saisie OTP : [Rare UI](https://www.rareui.com) (licence MIT + Commons Clause, crédit visible sur l'écran de connexion).

## Démarrer

```bash
npm install
cp .env.example .env.local   # puis compléter
npm run dev
```

Sans Gmail configuré, en développement, le code OTP est affiché dans la console du serveur.

## Configuration

| Variable | Rôle |
| --- | --- |
| `AUTH_SECRET` | Signe les sessions (30 jours) et les défis OTP. Obligatoire en production. |
| `NOTION_TOKEN` | Jeton d'une intégration Notion **connectée à la base Documents** (menu ••• de la base → Connexions). |
| `GMAIL_*` | Envoi des codes depuis theo@gouman.fr, en OAuth2 (Gmail API) ou mot de passe d'application. |
| `UPSTASH_REDIS_REST_*` | Compteur de tentatives et anti-renvoi des codes. Sans lui, stockage mémoire : pas fiable en serverless. |

## Authentification

- Liste blanche côté serveur (`src/lib/server/people.ts`) : Théo (2 adresses, le code part sur les deux), Corine, Mélanie, Laura.
- Code à 4 chiffres, valable 10 min, 5 essais max (compteur incrémenté avant comparaison), renvoi possible toutes les 30 s.
- Session : JWT HS256 en cookie `httpOnly`, vérifié par `src/proxy.ts` sur toutes les pages et API.
- Les fichiers Notion passent par `/api/files/[pageId]/[index]` (session requise, page vérifiée comme appartenant à la base) : les URL Notion signées ne sont jamais exposées.

## Base Notion

Propriétés lues : `Nom` (titre), `Descriptions` (texte), `Fichiers` (fichiers), `Date d'ajout` (date, tri décroissant). Miniatures : image → l'image ; PDF → 1re page rendue avec pdf.js dans le navigateur ; autre → couverture générée.

## Transition « zoom » réutilisable

`src/components/zoom/` — moteur (`engine.ts`) + composants React (`zoom.tsx`) :

```tsx
<ZoomProvider>
  <button onClick={() => open(id)}>
    <ZoomSource id={id} className="rounded-[18px]">…miniature…</ZoomSource>
  </button>

  <ZoomPresentation
    getMeta={(id) => ({ aspect: 16 / 9, align: [0.5, 0.5] })}   // ratio naturel du contenu de l'objet
    renderObject={(id) => <img … className="size-full object-cover" />}
  >
    {(id) => (
      <>
        <ZoomSecondary>…barre, bouton fermer…</ZoomSecondary>
        <ZoomTarget className="aspect-[4/3] rounded-[24px]" />   {/* où l'objet se pose */}
        <ZoomSecondary>…titre, texte, actions…</ZoomSecondary>
      </>
    )}
  </ZoomPresentation>
</ZoomProvider>
```

Principe : un seul objet (jamais de doublon), interpolé chaque frame entre la position **mesurée en direct** de la source et celle de la destination, avec un ressort interruptible. Le contenu est mis à l'échelle uniformément (recadrage, jamais d'étirement) ; coins et ombre sont recalculés, donc jamais déformés. Fermeture par bouton, Échap, clic sur le fond, glisser vers le bas (souris ou doigt, seulement en haut du contenu) ou pincement ; la vitesse du doigt est transmise au ressort. Source invisible → retour au centre en fondu. « Réduire les animations » → simple fondu.

## Mode démo (développement)

`DEMO_DOCUMENTS=1 npm run dev` affiche des documents fictifs ; déposer `statuts.pdf` et `facade.png` dans `public/demo/` (non versionné).
