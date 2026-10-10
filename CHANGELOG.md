# Changelog

## [1.3.0](https://github.com/Bredda/experiments/compare/v1.2.0...v1.3.0) (2026-10-10)


### Features

* run page polish ([#69](https://github.com/Bredda/experiments/issues/69)) ([daef3ae](https://github.com/Bredda/experiments/commit/daef3aec5d5e5a476cbb751b1178336f582c0b6f))


### Bug Fixes

* plan.sh must not demote an epic already in progress ([#89](https://github.com/Bredda/experiments/issues/89)) ([cd53f9b](https://github.com/Bredda/experiments/commit/cd53f9b9b3a6f7cbe6f537eef1462d28480309eb))


### Documentation

* describe the issue and pull request workflow ([#91](https://github.com/Bredda/experiments/issues/91)) ([d53ae40](https://github.com/Bredda/experiments/commit/d53ae40f7b4d841e730dc61efb15deec7d97d4cc))
* plan work in github issues and squash-merge pull requests ([#68](https://github.com/Bredda/experiments/issues/68)) ([22c7a40](https://github.com/Bredda/experiments/commit/22c7a40c9ac4570c5a1c300f36ef50a58627f652))
* refresh the roadmap and point to the platform repo ([#115](https://github.com/Bredda/experiments/issues/115)) ([2d5476e](https://github.com/Bredda/experiments/commit/2d5476e67e93e60c790139148f84099199d44450))

## [1.2.0](https://github.com/Bredda/experiments/compare/v1.1.0...v1.2.0) (2026-10-08)


### Features

* **api:** intervene on a run when stepping or forking ([d100836](https://github.com/Bredda/experiments/commit/d1008364b0c6126b9554c798bd49a211d23098e5))
* define persona and model per agent in the scenario ([f678f17](https://github.com/Bredda/experiments/commit/f678f174d8d3287b1aa8e5f5e3c6f3e30d14367f))
* **engine:** add last_n memory strategy ([9d28111](https://github.com/Bredda/experiments/commit/9d28111900ffe9411fa75edc4644c4771dff4c28))
* fork a run at a step and record the fork tree ([9d8cb0f](https://github.com/Bredda/experiments/commit/9d8cb0fbdbcd08f9eba52882585507782134d3cf))
* fork run ([77ea65f](https://github.com/Bredda/experiments/commit/77ea65fd936056c382fed6388cb3022f9878a52a))
* record model and token usage on agent.prompt_built ([1091bdd](https://github.com/Bredda/experiments/commit/1091bdd1fd97ec887dbe74dd68a668554ab32dac))
* **ui:** configure persona, model and memory per agent and show model usage ([a458f6f](https://github.com/Bredda/experiments/commit/a458f6f058aebc3e6e8d37b6579b9605dc3aa8d0))
* **ui:** fork a run from the run page and browse its fork tree ([7bcbb8f](https://github.com/Bredda/experiments/commit/7bcbb8f94a760464917e3e46c03742210d6b20c0))
* **ui:** intervene on an agent from the run page ([f679516](https://github.com/Bredda/experiments/commit/f6795163888a589634df7b656a88da9024b66a98))
* **ui:** open any agent of a room from its card ([61dede7](https://github.com/Bredda/experiments/commit/61dede79c33ec59d7a0fa43454edfaf7cde20aeb))


### Bug Fixes

* **settings:** accept any sk-ant- Anthropic key ([6e8e9d2](https://github.com/Bredda/experiments/commit/6e8e9d21ba07368cb30b59acd2dd4511a8668c7e))


### Performance

* smaller docker images and faster rebuilds ([614d59e](https://github.com/Bredda/experiments/commit/614d59e6c7fbbf64aa89052360f600a9a0dff991))


### Refactoring

* **ai:** extract llm prompt building and model runner ([e817cfd](https://github.com/Bredda/experiments/commit/e817cfd2620f8d0e71f6964f4313ab9d36ea7726))
* **engine:** apply interventions when stepping and forking ([d1fde63](https://github.com/Bredda/experiments/commit/d1fde6364a29bd479fd894cae090916efb4393e9))
* **engine:** pass agent behavior factories a params object ([2287ea0](https://github.com/Bredda/experiments/commit/2287ea0e486c3304da9120af33f65607bcdf9e8c))
* **types:** define the intervention events and requests ([679c2cd](https://github.com/Bredda/experiments/commit/679c2cd6b49d99689b22b64181595f2304929c42))
* **ui:** merge the fork button and the fork tree into one sheet ([c6d2f75](https://github.com/Bredda/experiments/commit/c6d2f756bcff8588be7067dd22a224bbff575537))
* **ui:** read interventions in the log, the chat and the agent views ([5b9da7d](https://github.com/Bredda/experiments/commit/5b9da7d56e94d22fb0795234b9a46e51e4880a2c))
* **ui:** show the run status and the way back to live in one component ([e55aaa3](https://github.com/Bredda/experiments/commit/e55aaa349ccc51726326036e02a3a2a6c6b397af))


### Documentation

* add interventions and run page discoverability to the backlog ([6470c0e](https://github.com/Bredda/experiments/commit/6470c0eadee72f2439bff87aa73c8cd56213724e))
* close the interventions plan in todo.md ([aac1adc](https://github.com/Bredda/experiments/commit/aac1adcea41491f3c4c56af1de34211d80a686d3))
* describe interventions in the engine, api, ui and roadmap docs ([ac09aeb](https://github.com/Bredda/experiments/commit/ac09aeb6b7cb855d891bfcb52e0612afcb650cc6))
* mark agents and memory done in the roadmap ([f3b3999](https://github.com/Bredda/experiments/commit/f3b3999a50dc0d0acb023b7cc525e42a681a4a4f))
* merge pull requests with rebase instead of squash ([088478d](https://github.com/Bredda/experiments/commit/088478d223adf11fc096763d2f66eb9b0e2f3c15))
* plan agents and memory in todo.md ([c2692bb](https://github.com/Bredda/experiments/commit/c2692bb45ffcf6f498ad7a2150e4846c93f4edd0))
* plan the first slice of interventions in todo.md ([f697848](https://github.com/Bredda/experiments/commit/f69784812bfdefc1bd333189a220a70c49206e5f))
* roadmap backlog ([#9](https://github.com/Bredda/experiments/issues/9)) ([de7cb82](https://github.com/Bredda/experiments/commit/de7cb82a7e218bf44855124e1dcebc8b4392e0ca))

## [1.1.0](https://github.com/Bredda/experiments/compare/v1.0.0...v1.1.0) (2026-10-04)


### Features

* inspection replay ([#7](https://github.com/Bredda/experiments/issues/7)) ([c712858](https://github.com/Bredda/experiments/commit/c7128582a659bc62f2f16a5a587584aba7f42309))

## 1.0.0 (2026-10-03)


### Features

* **engine:** agents propose concurrently within a step ([#3](https://github.com/Bredda/experiments/issues/3)) ([72ffc8a](https://github.com/Bredda/experiments/commit/72ffc8ade7a9df2aaf7c65ab93e71c1b4bbc580a))
* run from ui & api instead of yml ([e0d8633](https://github.com/Bredda/experiments/commit/e0d8633c915326cbf307d5f3edacec0093d0dc68))


### Bug Fixes

* stabilize ui layout ([4072d67](https://github.com/Bredda/experiments/commit/4072d67f07c8b6fc78b5ce9e22f4e847e0e9e5b1))
