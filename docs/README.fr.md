<p align="center">
  <img src="../assets/cover.png" alt="nitpic" width="640" />
</p>

<h3 align="center">Cliquez sur n'importe quoi. Dites ce qui cloche. Regardez Claude le corriger.</h3>

<p align="center">
  <a href="../LICENSE"><img src="https://img.shields.io/badge/licence-MIT-91C31C?style=flat-square" alt="Licence MIT" /></a>
  <a href="https://chromewebstore.google.com/detail/eamfkghlemjhefpdlmpjkjadacgcanll"><img src="https://img.shields.io/badge/Chrome%20Web%20Store-disponible-91C31C?style=flat-square&logo=googlechrome&logoColor=white" alt="Chrome Web Store" /></a>
  <img src="https://img.shields.io/badge/Claude%20Code-plugin-91C31C?style=flat-square&logo=anthropic&logoColor=white" alt="Plugin Claude Code" />
  <a href="https://buymeacoffee.com/jibrilai"><img src="https://img.shields.io/badge/%E2%98%95-offrez--moi%20un%20caf%C3%A9-FFDD00?style=flat-square" alt="Offrez-moi un café" /></a>
</p>

<p align="center">
  <a href="../README.md">English</a> ·
  <a href="README.es.md">Español</a> ·
  <a href="README.fr.md">Français</a> ·
  <a href="README.de.md">Deutsch</a> ·
  <a href="README.ja.md">日本語</a> ·
  <a href="README.zh-CN.md">简体中文</a> ·
  <a href="README.ar.md">العربية</a>
</p>

---

**nitpic** relie votre navigateur à [Claude Code](https://claude.com/claude-code). Activez le mode feedback, cliquez sur n'importe quel élément de n'importe quelle page — `localhost` ou production —, écrivez ce qui doit changer et envoyez. Votre commentaire, une capture d'écran recadrée et le HTML de l'élément arrivent dans votre session Claude Code **comme si vous les aviez tapés là-bas**, et Claude se met au travail.

Conçu pour les designers, développeurs et *vibe coders* qui relisent leur app dans le navigateur mais la corrigent dans le terminal.

## ✨ Fonctionnalités

- **🎯 Pointez le problème** — survolez pour surligner n'importe quel élément ou sélectionnez une zone ; nitpic capture le sélecteur CSS, une capture d'écran et le HTML pour vous
- **⚡ Livraison instantanée** — le feedback atterrit dans votre terminal en une seconde (tmux et iTerm2 bénéficient d'une véritable injection clavier ; ailleurs, il arrive au prochain tour de Claude)
- **🎛 Vous choisissez la session** — tapez `/nitpic` dans la session Claude Code qui doit écouter ; relancez-le ailleurs pour déplacer la connexion
- **📚 Revues groupées** — accumulez des commentaires sur plusieurs pages et onglets, puis envoyez-les en un seul message, groupés par page
- **🫧 Panneau flottant** — déplaçable, réductible en pastille, ne rétrécit jamais votre viewport et ne déclenche aucun breakpoint responsive
- **🔒 100 % local** — pas de compte, pas de serveur, pas de télémétrie ; tout reste sur votre machine
- **🪄 Zéro friction** — l'appairage est automatique ; vous ne copiez jamais de code et ne touchez à aucun fichier de config

## 🚀 Démarrage rapide

**1. Installez l'extension Chrome** — en un clic depuis le [Chrome Web Store](https://chromewebstore.google.com/detail/eamfkghlemjhefpdlmpjkjadacgcanll)

**2. Installez le plugin Claude Code** — collez dans n'importe quelle session :

```
/plugin marketplace add jibril4000/nitpic
/plugin install nitpic@nitpic
```

**3. Connectez** — dans la session qui doit recevoir le feedback :

```
/nitpic
```

**4. Chipotez** — cliquez sur l'icône nitpic sur la page en cours de revue, **Start feedback**, cliquez sur n'importe quoi, commentez, **Send**. C'est toute la boucle.

## 🧠 Fonctionnement

| Votre terminal | Livraison |
| --- | --- |
| tmux | ⚡ instantanée — injectée dans le pane exact |
| iTerm2 | ⚡ instantanée — injectée via l'API de session |
| autre | ⏭ aux limites de tour — arrive quand Claude termine sa réponse en cours, avec une notification |

Captures et extraits HTML sont écrits dans `<projet>/.feedback/` (ajouté au `.gitignore` automatiquement). Si aucune session n'écoute, le feedback est mis en file sur disque et livré dès qu'une session se connecte.

## 🔒 Confidentialité et sécurité

Tout est local : le standard n'écoute que sur `127.0.0.1`, et un jeton d'appairage (échangé automatiquement) empêche des pages web arbitraires de lui parler. L'extension ne collecte aucune donnée.

## 🗺 Feuille de route

- [x] Claude Code
- [ ] Cursor
- [ ] Codex
- [ ] Gemini CLI
- [ ] Injection dans le terminal VS Code
- [ ] Aperçu aux tailles d'appareil
- [ ] Chrome Web Store + appairage sans jeton

## ☕ Soutenir

Si nitpic vous épargne dix allers-retours, [offrez-moi un café](https://buymeacoffee.com/jibrilai). Créé par [Jibril](https://linkedin.com/in/jibril-ai).

## 📝 Licence

[MIT](../LICENSE)
