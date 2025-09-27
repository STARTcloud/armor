# Changelog

## [1.13.3](https://github.com/STARTcloud/armor_private/compare/v1.13.2...v1.13.3) (2025-09-27)


### Bug Fixes

* route database operations to databaseLogger and HTTP requests to accessLogger ([78fd182](https://github.com/STARTcloud/armor_private/commit/78fd182bafe3d67204617dd1e7fe6e047e040bcd))

## [1.13.2](https://github.com/STARTcloud/armor_private/compare/v1.13.1...v1.13.2) (2025-09-27)


### Bug Fixes

* remove 1000ms batch delay from database operations for immediate file processing ([1048ae7](https://github.com/STARTcloud/armor_private/commit/1048ae7884c5bbe5310581ff51676e3883f169f9))

## [1.13.1](https://github.com/STARTcloud/armor_private/compare/v1.13.0...v1.13.1) (2025-09-27)


### Bug Fixes

* remove setTimeout delays from file watcher while keeping awaitWriteFinish ([2426e07](https://github.com/STARTcloud/armor_private/commit/2426e0733f952440394c2c432ec7a925de1a9e0c))

## [1.13.0](https://github.com/STARTcloud/armor_private/compare/v1.12.0...v1.13.0) (2025-09-27)


### Features

* implement corrected file watcher and checksum architecture ([b62af95](https://github.com/STARTcloud/armor_private/commit/b62af95a8f1c159330afd7be45b1dc168176e2ab))

## [1.12.0](https://github.com/STARTcloud/armor_private/compare/v1.11.0...v1.12.0) (2025-09-26)


### Features

* separate file detection and checksum processing into independent processes ([538b703](https://github.com/STARTcloud/armor_private/commit/538b7034a25a1c53b6ed070ff410fa0aef6a8004))

## [1.11.0](https://github.com/STARTcloud/armor_private/compare/v1.10.1...v1.11.0) (2025-09-26)


### Features

* implement worker threads for checksum calculation and fix chokidar unlink detection ([b8109eb](https://github.com/STARTcloud/armor_private/commit/b8109eb1018ef773084a142eb25a0c2643714051))


### Bug Fixes

* add retry mechanism for files stuck in error status ([8a7b2fb](https://github.com/STARTcloud/armor_private/commit/8a7b2fb26ddcfdc3e210f38df029ca1a847f8fbf))
* replace __filename with import.meta.url for ES module compatibility in worker threads ([9948834](https://github.com/STARTcloud/armor_private/commit/99488340c4992dcd3c300c3ada4c37d36b9b7deb))

## [1.10.1](https://github.com/STARTcloud/armor_private/compare/v1.10.0...v1.10.1) (2025-09-26)


### Bug Fixes

* move checksum calculation outside database transactions to resolve SQLITE_BUSY errors ([8334e85](https://github.com/STARTcloud/armor_private/commit/8334e8501e52a8c7d2430c287ad7461bc2ac1458))

## [1.10.0](https://github.com/STARTcloud/armor_private/compare/v1.9.0...v1.10.0) (2025-09-26)


### Features

* implement database operation batching to fix SQLite locking issues ([0f4cf80](https://github.com/STARTcloud/armor_private/commit/0f4cf801575d9fc2193b514f1ae7d9d151a3e19c))
* implement database operation batching to fix SQLite locking issues ([c5ca5d6](https://github.com/STARTcloud/armor_private/commit/c5ca5d662167f08da7c10ec7362a1ac91077450e))


### Bug Fixes

* complete SSE implementation for real-time file events ([6ce622a](https://github.com/STARTcloud/armor_private/commit/6ce622a23f9be7630620189095ff87f1146e0998))
* resolve checksum update text matching issue in SSE implementation ([b0be103](https://github.com/STARTcloud/armor_private/commit/b0be1037b156c48008b86b146ca7ae415de833dc))

## [1.9.0](https://github.com/STARTcloud/armor_private/compare/v1.8.1...v1.9.0) (2025-09-26)


### Features

* add debug logging to unlinkDir handler and fix all dynamic imports ([f14db60](https://github.com/STARTcloud/armor_private/commit/f14db60bba1c2ff4c7cd03faf97b87d046e0e72a))
* add more targeted debug logging to isolate SSE execution issue ([51363a3](https://github.com/STARTcloud/armor_private/commit/51363a3609711480ba13109c3f142653a12f9edf))
* add SSE notifications to unlinkDir handler and fix dynamic imports ([ff70f6c](https://github.com/STARTcloud/armor_private/commit/ff70f6cccd113f39a826b8c2a85901e5254a03c8))
* add SSE notifications to unlinkDir handler for real-time UI updates ([7e42bd5](https://github.com/STARTcloud/armor_private/commit/7e42bd5d359d4fc4479affd7ca53b6481dddba53))
* add unlinkDir event handler for directory move cleanup ([d3c6310](https://github.com/STARTcloud/armor_private/commit/d3c6310869b82eee148485b6c4a526da068eda54))
* add unlinkDir event handler for directory move cleanup ([39f502d](https://github.com/STARTcloud/armor_private/commit/39f502d43b0edc7713471e02a85c57167d8d444d))


### Bug Fixes

* resolve lint formatting errors in fileWatcher.js ([edb593e](https://github.com/STARTcloud/armor_private/commit/edb593e0dca880b63510962957844d53e733246d))
* resolve lint formatting errors in fileWatcher.js ([e0b4e59](https://github.com/STARTcloud/armor_private/commit/e0b4e5988a2e49976b1a0647b92fce6237cd9c87))

## [1.8.1](https://github.com/STARTcloud/armor_private/compare/v1.8.0...v1.8.1) (2025-09-25)


### Bug Fixes

* add proper top spacing to API Keys page header and buttons ([3da8fbd](https://github.com/STARTcloud/armor_private/commit/3da8fbd923330b8a35ede835e5155df91e21e1be))
* ensure consistent table sizing and form input styling across pages ([a055bee](https://github.com/STARTcloud/armor_private/commit/a055bee256989b53e4f05de6873b9e41150f15e6))
* remove mt-4 class to match directory listing container structure ([cd0c216](https://github.com/STARTcloud/armor_private/commit/cd0c21600069c54860debe42ad488c58d72bb3cb))
* styling consistency fixes for API Keys and directory listing pages ([50e999b](https://github.com/STARTcloud/armor_private/commit/50e999bd028463c02317b79017d7f823623ef5b1))

## [1.8.0](https://github.com/STARTcloud/armor_private/compare/v1.7.1...v1.8.0) (2025-09-25)


### Features

* add local-only logout endpoints for dashboard flexibility ([92b6612](https://github.com/STARTcloud/armor_private/commit/92b6612fa96e3975933014334f3e9fe6cded26ff))
* add logout buttons to UI dropdown for both RP-initiated and local logout options ([5138935](https://github.com/STARTcloud/armor_private/commit/513893563ca57df2c4f0fd722f6b180a98812fc6))

## [1.7.1](https://github.com/STARTcloud/armor_private/compare/v1.7.0...v1.7.1) (2025-09-25)


### Bug Fixes

* resolve routing conflict causing search failure from root directory ([52d0853](https://github.com/STARTcloud/armor_private/commit/52d08530a5f3c0c66fa986f3cf1758bae558ca12))

## [1.7.0](https://github.com/STARTcloud/armor_private/compare/v1.6.0...v1.7.0) (2025-09-25)


### Features

* add basic authentication hiding functionality ([144adff](https://github.com/STARTcloud/armor_private/commit/144adff52460ae867d3672a34db1599f131c5c2d))
* add OIDC hiding configuration to production config template ([835c9ce](https://github.com/STARTcloud/armor_private/commit/835c9ceeba43345d053b9a8917fa2b3315c2a7ce))
* add size sorting functionality to file server table ([e8e9a8d](https://github.com/STARTcloud/armor_private/commit/e8e9a8dda71e33cd664ea0cd185658808bb84959))
* implement OIDC provider hiding functionality ([a3d2476](https://github.com/STARTcloud/armor_private/commit/a3d247668818c9d30b68388ee8cceae5db1d8b9e))


### Bug Fixes

* prevent table sorting redirect to landing page when show_root_index is false ([b6f0f96](https://github.com/STARTcloud/armor_private/commit/b6f0f96fd683488b1ae7472600627c330b5afc0f))
* resolve routing conflict causing JSON parse error in root folder creation ([bbae83b](https://github.com/STARTcloud/armor_private/commit/bbae83b53d04412c168280e2512ebd28f7064f0c))

## [1.6.0](https://github.com/STARTcloud/armor_private/compare/v1.5.0...v1.6.0) (2025-09-25)


### Features

* add uniform header to Swagger API documentation page ([49939a3](https://github.com/STARTcloud/armor_private/commit/49939a35222d9b236e259bb31c84c23b7b158c53))
* add upload section toggle and improve API Keys page UI ([08d8063](https://github.com/STARTcloud/armor_private/commit/08d80638bcaad3a4150d4545260bb319e9ae0fa4))
* add upload section toggle and improve API Keys page UI ([eb8e3d9](https://github.com/STARTcloud/armor_private/commit/eb8e3d9a74e54378155c2a9203e37d93623b207b))


### Bug Fixes

* change upload toggle button to blue and match search input styling ([5f968e7](https://github.com/STARTcloud/armor_private/commit/5f968e714c2cb76f96f52c7e2b88bd903e93fd3f))

## [1.5.0](https://github.com/STARTcloud/armor_private/compare/v1.4.1...v1.5.0) (2025-09-25)


### Features

* add robots.txt to allow major search engines and block unwanted crawlers ([1753ac9](https://github.com/STARTcloud/armor_private/commit/1753ac953b871845c8bdd5985644b07ef7019d97))
* add weekly compression for archived log files ([86cce8f](https://github.com/STARTcloud/armor_private/commit/86cce8ff8ac4158652e690208c9d23e5fe11b70a))
* add weekly compression for archived log files ([744322c](https://github.com/STARTcloud/armor_private/commit/744322c8beecda26345bfa6b64cb9ac923a3c29b))


### Bug Fixes

* route OIDC authentication logs to auth.log instead of app.log ([ef16486](https://github.com/STARTcloud/armor_private/commit/ef16486448ce0ab60a06790b79dd60e304cd48a7))
* route OIDC authentication logs to auth.log instead of app.log ([37dbd0c](https://github.com/STARTcloud/armor_private/commit/37dbd0ce08c5b8468086970e21d494fc5d25dbd1))

## [1.4.1](https://github.com/STARTcloud/armor_private/compare/v1.4.0...v1.4.1) (2025-09-25)


### Bug Fixes

* Merge pull request [#38](https://github.com/STARTcloud/armor_private/issues/38) from STARTcloud/devin/1727265680-docs-cleanup-oidc-logout ([e2663d8](https://github.com/STARTcloud/armor_private/commit/e2663d8e1f69610650234a4a8d04515c9fd31ccd))


### Documentation

* remove unused post_logout_redirect_uris config and add comprehensive OIDC logout documentation ([e2663d8](https://github.com/STARTcloud/armor_private/commit/e2663d8e1f69610650234a4a8d04515c9fd31ccd))
* remove unused post_logout_redirect_uris config and add comprehensive OIDC logout documentation ([5a6671f](https://github.com/STARTcloud/armor_private/commit/5a6671f2e496920f4b8a52e69bae93732b5c7354))

## [1.4.0](https://github.com/STARTcloud/armor_private/compare/v1.3.2...v1.4.0) (2025-09-25)


### Features

* add RP-initiated logout support for OIDC providers ([d4ec7dd](https://github.com/STARTcloud/armor_private/commit/d4ec7dd314001cd70b48f79319fb2c9d1b9acf89))
* implement RP-initiated logout support for OIDC configurations ([bf996ef](https://github.com/STARTcloud/armor_private/commit/bf996ef265dfcabc236de3267d2b886e526dd890))


### Bug Fixes

* correct buildEndSessionUrl API usage for openid-client v6.8.0 ([3705722](https://github.com/STARTcloud/armor_private/commit/37057222df403c34059a85326ae78b9cd6f72190))
* resolve linting issues in logout error handling ([2dde50f](https://github.com/STARTcloud/armor_private/commit/2dde50ff833be1b970eae6b5fdfe40163528bc2e))

## [1.3.2](https://github.com/STARTcloud/armor_private/compare/v1.3.1...v1.3.2) (2025-09-25)


### Documentation

* add PostgreSQL and MySQL database configuration examples ([06173d2](https://github.com/STARTcloud/armor_private/commit/06173d288febe2e8c93b61db5d456286c1523938))

## [1.3.1](https://github.com/STARTcloud/armor_private/compare/v1.3.0...v1.3.1) (2025-09-25)


### Bug Fixes

* adding mysql and postgres for sequelize ([d84ee02](https://github.com/STARTcloud/armor_private/commit/d84ee02bf02591443b7d7761d20986d299b559a9))

## [1.3.0](https://github.com/STARTcloud/armor_private/compare/v1.2.0...v1.3.0) (2025-09-25)


### Features

* implement comprehensive database optimizations and fix checksum transaction bug ([ea02912](https://github.com/STARTcloud/armor_private/commit/ea02912aaabf456b77167c2cf19ea347fb1b0a85))


### Bug Fixes

* correct logging to show actual affected rows instead of undefined ([94da725](https://github.com/STARTcloud/armor_private/commit/94da72522c30815fbb8ab1e2868a067833bba120))
* resolve checksum transaction error by moving getDatabase import to top of file ([182a26a](https://github.com/STARTcloud/armor_private/commit/182a26ae489ba6a4c5812eea071f9f04e184733b))
* resolve undefined rows logging issue in checksum processing ([cc638ba](https://github.com/STARTcloud/armor_private/commit/cc638badb3b7c76dff610167f79f2ad19490f9d4))
* use array destructuring for linting compliance ([916b9f7](https://github.com/STARTcloud/armor_private/commit/916b9f7b41b526e611861151df9a46e651b4cdb1))

## [1.2.0](https://github.com/STARTcloud/armor_private/compare/v1.1.2...v1.2.0) (2025-09-25)


### Features

* optimize database transactions for checksum processing ([89e9398](https://github.com/STARTcloud/armor_private/commit/89e939830768d7f076734517cd752c9060b1784c))

## [1.1.2](https://github.com/STARTcloud/armor_private/compare/v1.1.1...v1.1.2) (2025-09-25)


### Bug Fixes

* preserve checksum status in cacheItemInfoWithStats to prevent unnecessary recalculation on restart ([a0e9a6c](https://github.com/STARTcloud/armor_private/commit/a0e9a6cd65d14eb6b3d925cf26989d043ece4a9e))

## [1.1.1](https://github.com/STARTcloud/armor_private/compare/v1.1.0...v1.1.1) (2025-09-25)


### Bug Fixes

* allow JSON API access to root directory when show_root_index is false ([9374a0e](https://github.com/STARTcloud/armor_private/commit/9374a0ea9cdfdae174c58a316f0f66d602d671f8))
* allow JSON API access to root directory when show_root_index is false ([2b6d47f](https://github.com/STARTcloud/armor_private/commit/2b6d47f98d897baf630537aef34948a1c0308968))

## [1.1.0](https://github.com/STARTcloud/armor_private/compare/v1.0.15...v1.1.0) (2025-09-25)


### Features

* add development configuration support ([c1816a0](https://github.com/STARTcloud/armor_private/commit/c1816a0f288226b27abc98bc19486960a7e9f718))


### Bug Fixes

* eliminate await-in-loop linting warning in auth middleware ([3b52009](https://github.com/STARTcloud/armor_private/commit/3b52009795c596ad9622b816c754b06343c51c37))
* optimize API key authentication to fix N+1 query problem ([5b4a03f](https://github.com/STARTcloud/armor_private/commit/5b4a03fc88ffe5250bc2a85e621bc5f4188a00c6))
* resolve prettier formatting error in app.js ([4e95cec](https://github.com/STARTcloud/armor_private/commit/4e95cec2004ee4915f6ef21f68fa2d811221be2b))
* set up user context in authenticateApiKeyAccess for basic auth ([abb5201](https://github.com/STARTcloud/armor_private/commit/abb520162a65ab738f95f901f3ea99ff1f2b5a86))

## [1.0.15](https://github.com/STARTcloud/armor_private/compare/v1.0.14...v1.0.15) (2025-09-25)


### Bug Fixes

* versioning ([88a5da7](https://github.com/STARTcloud/armor_private/commit/88a5da7171ee289a88139def61a80af0e05db390))
* versioning ([a30efb3](https://github.com/STARTcloud/armor_private/commit/a30efb3ab8fb5dceea0e5540c32b87a95dd6ae17))

## [1.0.14](https://github.com/STARTcloud/armor_private/compare/v1.0.13...v1.0.14) (2025-09-25)


### Bug Fixes

* packaging ([aa7b588](https://github.com/STARTcloud/armor_private/commit/aa7b588800adae39d4b7c4e48799d5f06debb011))

## [1.0.13](https://github.com/STARTcloud/armor_private/compare/v1.0.12...v1.0.13) (2025-09-25)


### Bug Fixes

* oidc users api keys ([19779ac](https://github.com/STARTcloud/armor_private/commit/19779ac995ca5b35258c4b2d24d1ae9759c02310))
* packaging ([ac6c800](https://github.com/STARTcloud/armor_private/commit/ac6c800767fdc25aaa9427e1aacfdbdd82b0bda2))

## [1.0.12](https://github.com/STARTcloud/armor_private/compare/v1.0.11...v1.0.12) (2025-09-25)


### Bug Fixes

* versioning ([af10e47](https://github.com/STARTcloud/armor_private/commit/af10e4720eed21c74364fe842f14701fd913dbe8))

## [1.0.11](https://github.com/STARTcloud/armor_private/compare/v1.0.10...v1.0.11) (2025-09-25)


### Bug Fixes

* detailed logging and log rotation ([7896bbe](https://github.com/STARTcloud/armor_private/commit/7896bbe97f5e718edbfc054189a1a368f99d326a))
* landing page and config merging ([713e1cc](https://github.com/STARTcloud/armor_private/commit/713e1ccbf9863017e7042042dee322ce6e465428))
* landing page and config merging ([19eb540](https://github.com/STARTcloud/armor_private/commit/19eb5406f743d6e8f541015697ef3269a58ea0fa))
* linting ([d767332](https://github.com/STARTcloud/armor_private/commit/d76733266f85567f7a8974bcd55385df46dfd843))
* oidc roles ([45442da](https://github.com/STARTcloud/armor_private/commit/45442da47ddb3ad236ac5208b4cbb45bd5d6bab7))
* versioning ([b251d1c](https://github.com/STARTcloud/armor_private/commit/b251d1c72fb5c22225ad1702e5ca757ad32d323e))

## [1.0.10](https://github.com/STARTcloud/armor_private/compare/v1.0.9...v1.0.10) (2025-09-25)


### Bug Fixes

* landing page and config merging ([73acdfa](https://github.com/STARTcloud/armor_private/commit/73acdfa94093e50b21d184b992fddbea8448e5dc))

## [1.0.9](https://github.com/STARTcloud/armor_private/compare/v1.0.8...v1.0.9) (2025-09-25)


### Bug Fixes

* yaml config updates ([3f70818](https://github.com/STARTcloud/armor_private/commit/3f708186bb1542170f07455f880d17c9a8c8eefc))

## [1.0.8](https://github.com/STARTcloud/armor_private/compare/v1.0.7...v1.0.8) (2025-09-25)


### Bug Fixes

* adding distinguished names for Domino users without emails ([e115383](https://github.com/STARTcloud/armor_private/commit/e11538377f17077b8b74be7936db5ddcea50d6c8))
* adding distinguished names for Domino users without emails ([eb2d48a](https://github.com/STARTcloud/armor_private/commit/eb2d48ad5667ef94572df9c3636873a67fe7d9e1))
* adding distinguished names for Domino users without emails ([3ec6295](https://github.com/STARTcloud/armor_private/commit/3ec62952c4fdee74685aee68514313134908701d))
* documentation ([b9c16bf](https://github.com/STARTcloud/armor_private/commit/b9c16bf5506afd44588486ccd690e48fa23165b8))
* documentation and use system certs ([37ac193](https://github.com/STARTcloud/armor_private/commit/37ac193853720ea74d6b565724ceb87761bdd39a))
* linting ([8ce4fe2](https://github.com/STARTcloud/armor_private/commit/8ce4fe241a08eda013a16acaf608dc82e9ca57b0))

## [1.0.7](https://github.com/STARTcloud/armor_private/compare/v1.0.6...v1.0.7) (2025-09-24)


### Bug Fixes

* logging ([a2a3778](https://github.com/STARTcloud/armor_private/commit/a2a3778bd84b43b72c8ab9bf1ef1134083971171))
* oidc token method ([2451e37](https://github.com/STARTcloud/armor_private/commit/2451e37086318b7704a8829541320732e9d78897))
* oidc token method ([8a81ed9](https://github.com/STARTcloud/armor_private/commit/8a81ed9dc7f8dbe23815bed340d8992a7f219959))
* oidc token method ([a940eff](https://github.com/STARTcloud/armor_private/commit/a940effdf0acac12d3cb80137fbbc3b535457fc0))

## [1.0.6](https://github.com/STARTcloud/armor_private/compare/v1.0.5...v1.0.6) (2025-09-24)


### Bug Fixes

* documentation ([7cca6f8](https://github.com/STARTcloud/armor_private/commit/7cca6f8245f3aaaddb1c692a46c6db5c2faba770))
* optimizations ([8afb296](https://github.com/STARTcloud/armor_private/commit/8afb296fa74028b7736b21b4e1fc66d235d583da))

## [1.0.5](https://github.com/STARTcloud/armor_private/compare/v1.0.4...v1.0.5) (2025-09-23)


### Bug Fixes

* documentation ([1cc6b98](https://github.com/STARTcloud/armor_private/commit/1cc6b989fbf0da60cf9b34db7f70ff76b3081310))

## [1.0.4](https://github.com/STARTcloud/armor_private/compare/v1.0.3...v1.0.4) (2025-09-23)


### Bug Fixes

* documentation ([7dc4451](https://github.com/STARTcloud/armor_private/commit/7dc4451fe5c6c3046d21f07c1984217881167f49))
* documentation ([b641468](https://github.com/STARTcloud/armor_private/commit/b64146808051dde6f4a383e68b2615b7af1e783d))
* documentation ([2c22c38](https://github.com/STARTcloud/armor_private/commit/2c22c38592d51e6e32aacf6b04e89252dcbe9aa1))
* documentation ([cc1c022](https://github.com/STARTcloud/armor_private/commit/cc1c022b8654bebec06c4747a4c1be028aa97b06))

## [1.0.3](https://github.com/STARTcloud/armor_private/compare/v1.0.2...v1.0.3) (2025-09-23)


### Bug Fixes

* docs ([bc70eae](https://github.com/STARTcloud/armor_private/commit/bc70eae62bc2fc39ce245991faa5d5d79cbf3915))

## [1.0.2](https://github.com/STARTcloud/armor_private/compare/v1.0.1...v1.0.2) (2025-09-23)


### Bug Fixes

* lint task ([5596510](https://github.com/STARTcloud/armor_private/commit/55965106740c2cdcbc4ad5416e8a73349db92b8f))

## [1.0.1](https://github.com/STARTcloud/armor_private/compare/v1.0.0...v1.0.1) (2025-09-23)


### Bug Fixes

* dependencies/actions/express 5 ([51d287b](https://github.com/STARTcloud/armor_private/commit/51d287bf583096d17ddd2688afc9271a80f85e3e))
* dependencies/actions/express 5 ([eb3d7b6](https://github.com/STARTcloud/armor_private/commit/eb3d7b6a6337ccf2941b7068118c64f8166d5e30))
* lint task ([b12a770](https://github.com/STARTcloud/armor_private/commit/b12a7709d9b780e75a7f93a52f967d5a1becaf07))
* lint task ([bee2b6d](https://github.com/STARTcloud/armor_private/commit/bee2b6d108276c35931d0311d92e1e25b272121c))
* lint task ([7fc5bb1](https://github.com/STARTcloud/armor_private/commit/7fc5bb1fd218dda9a2698c223dabf574b5203cc1))
* lint task ([0bc8b91](https://github.com/STARTcloud/armor_private/commit/0bc8b91e53ca24aaffcc0dff753f51107d5fdbe0))
* lint task ([d717191](https://github.com/STARTcloud/armor_private/commit/d7171913439cee6833a004a3c5a5cf244b2bdab1))

## [1.0.0](https://github.com/STARTcloud/armor_private/compare/v0.7.7...v1.0.0) (2025-09-23)


### Bug Fixes

* dependencies/actions/express 5 ([51d287b](https://github.com/STARTcloud/armor_private/commit/51d287bf583096d17ddd2688afc9271a80f85e3e))
* dependencies/actions/express 5 ([eb3d7b6](https://github.com/STARTcloud/armor_private/commit/eb3d7b6a6337ccf2941b7068118c64f8166d5e30))
* lint task ([7fc5bb1](https://github.com/STARTcloud/armor_private/commit/7fc5bb1fd218dda9a2698c223dabf574b5203cc1))
* lint task ([0bc8b91](https://github.com/STARTcloud/armor_private/commit/0bc8b91e53ca24aaffcc0dff753f51107d5fdbe0))
* lint task ([d717191](https://github.com/STARTcloud/armor_private/commit/d7171913439cee6833a004a3c5a5cf244b2bdab1))
