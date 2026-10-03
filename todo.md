- ui: Rewrite event log viewer
- short alphabetical seed
- Launch run from ui + steps throught action + Stream run into ui

# Launch run from ui + steps throught action + Stream run into ui

Découpage en tickets
Phase 0 — Persistence (prérequis)
Nouveau run store SQLite (table runs: run_id/name/seed/status/scenario_json/created_at ; table events: run_id/step/seq/type/payload_json/timestamp). Remplace le couple config.json+events.jsonl comme source de vérité. Le run existant dans /runs est une donnée de dev — je ne migrerais pas, on le laisse mourir plutôt que d'écrire un import ponctuel.

Phase 1 — Engine
Simulation/EventLog persistent chaque event au fil de l'eau (au lieu du dump final) via le run store. Statuts explicites created → running → completed. Le CLI batch (run_scenario) devient un simple wrapper qui boucle sur simulation.step() en utilisant les mêmes primitives — pas de duplication de logique entre CLI et API.

Phase 2 — API

GET /scenarios — liste les YAML de /scenarios
POST /runs — crée depuis un scenario, fait le setup(), statut running
POST /runs/{id}/steps/next — un step, persiste, renvoie les nouveaux events + statut (passe à completed si scenario.steps atteint)
GET /runs, /runs/{id}, /runs/{id}/events — repointés sur SQLite, valables pour runs en cours et terminés
Phase 3 — UI
Écran de sélection de scenario → POST /runs → redirection vers la page run. Sur la page run : bouton "Next step" si non terminé, qui append les events reçus à l'état local (il faut faire passer events de state serveur-only à state mutable côté client). Badge de statut dans RunHeader.

Phase 4 — différé, non cadré maintenant : play/pause, streaming intra-step si la latence LLM par step le justifie.

Ça correspond à la ligne que tu avais déjà dans todo.md. Je peux soit remplacer cette ligne par ce découpage détaillé dans le fichier, soit attaquer directement la Phase 0 — qu'est-ce que tu préfères ?
