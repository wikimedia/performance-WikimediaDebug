## 3.0.0

### Added

* Converted to WebExtensions Manifest v3 (Bryan Davis). ([T312694](https://phabricator.wikimedia.org/T312694))

## 2.9.0

### Added

* Allow wikitech.wikimedia.org ([T371537](https://phabricator.wikimedia.org/T371537))

## 2.8.0

### Added

* Add wikifunctions.org (James Forrester). ([T275945](https://phabricator.wikimedia.org/T275945))

## 2.7.1

### Fixed

* Fix dark mode version of the new output links area.

## 2.7.0

### Added

* Add "Excimer UI" option (Timo Tijhof) ([T291015](https://phabricator.wikimedia.org/T291015))
* Create new "output" area with last five xhgui/excimer/logstash links (Timo Tijhof)

### Fixed

* Fix unwanted animation in Chrome when popup opens ([T331249](https://phabricator.wikimedia.org/T331249))
* Improve "Unsupported" warning to render above form controls
* Improve "Read-only" label to say "Read-only DB"
* Faster popup render time by removing the "empty page" phase ([change 899034](https://gerrit.wikimedia.org/r/c/performance/WikimediaDebug/+/899034))

## 2.6.0

### Removed

* Remove obsolete "querysort" option (Ori Livneh)
* Remove obsolete PHP 7.4 option (Timo Tijhof)

## 2.5.0

### Added

* Add "querysort" option ([T138093](https://phabricator.wikimedia.org/T138093)) (Ori Livneh)
* Add PHP 7.4 option ([T312653](https://phabricator.wikimedia.org/T312653)) (mainframe98)
* Add "Unsupported domain" indicator ([T269028](https://phabricator.wikimedia.org/T269028)) (Larissa Gaulia)

### Fixed

* background: Faster popup opening by caching backends for 1 hour (Timo Tijhof)

## 2.4.6

### Fixed

* popup: Fix beta host menu. (Larissa Gaulia)
* Fix Logstash url to account for OpenSearch rebrand. (Larissa Gaulia)

## 2.4.5

### Fixed

* popup: Avoid "TypeError" in developer console when using Chrome. ([T294335](https://phabricator.wikimedia.org/T294335)) (Timo Tijhof)

## 2.4.4

### Fixed

* popup: Fix "character encoding" warning from Firefox devtools. (Timo Tijhof)
* background: Only fetch from noc.wikimedia.org when opening the popup.
  Previously the list was also fetched on every page load on a WMF domain
  in any tab, and when WikimediaDebug is off. (Timo Tijhof)
* Use x-request-id header for perf/logging link, instead of `mw.config` wgRequestId. ([T279211](https://phabricator.wikimedia.org/T279211)) (Timo Tijhof)

## 2.4.3

### Fixed

* List of debug servers is now fetched from noc.wikimedia.org. (Gilles Dubuc)

## 2.4.2

### Fixed

* Added mwdebug1003 to the list of servers. (Effie Mouzeli)

## 2.4.1

### Fixed

* Update XHGui address in Beta Cluster. Moved from `performance-beta.wmflabs.org` to <https://performance.wikimedia.beta.wmflabs.org>. (Timo Tijhof)

## 2.4

See also [WikimediaDebug v2 blog post](https://phabricator.wikimedia.org/phame/post/view/183/wikimediadebug_v2_is_here/).

### Added

* The popup has been redesigned to follow [Wikimedia Design](https://design.wikimedia.org/style-guide/) style guide, and now supports Dark Mode. (Timo Tijhof)

### Changed

* The labels for the footer links are now "Find in XHGui" and "Find in Logstash",
  instead of "Profiling Data" and "Debug Logs".

## 2.3

### Added

* Add support for XHGui in Beta Cluster. ([T180761](https://phabricator.wikimedia.org/T180761)) (Timo Tijhof)

### Changed

* When the extension shuts off after 15min, it now also resets Profiling and other checkboxes.

## 2.2

### Added

* Add new "Inline profile" option. ([#17](https://github.com/wikimedia/WikimediaDebug/issues/17)) (Timo Tijhof)

### Fixed

* Hide production backend choices when in Beta Cluster. ([#14](https://github.com/wikimedia/WikimediaDebug/issues/14))  (Timo Tijhof)
* Hide production XHGui link in Beta Cluster. (Timo Tijhof)
* Fix Logstash link in Beta Cluster to use logstash-beta. (Timo Tijhof)
* Update Logstash URL for Kibana 5 upgrade. (Timo Tijhof)

### Removed

* Remove "PHP 7" option, this is now the default. (Timo Tijhof)

## 2.1

### Added

* Add new "PHP 7" option for switching between HHVM and PHP 7. (Giuseppe Lavagetto)
* Document Firefox Add-on release proces. (Timo Tijhof)

## 2.0

### Fixed

* Update Codfw hostnames from mw20xx to mwdebug20xx. (Alex Monk)

## 1.9

### Added

* Add URL patterns for Beta Cluster. (Bryan Davis)

## 1.8.1

### Added

* Document support for Mozilla Firefox. (Kunal Mehta)
* Distribute as Firefox Add-on. (Bryan Davis)

## 1.8

### Fixed

* Update default value from mw10xx to mwdebug10xx. (Timo Tijhof)

## 1.7

### Fixed

* Update Eqiad hostnames from mw10xx to mwdebug10xx. (addshore)

## 1.6

### Fixed

* `wikidata.org` is now included in the the permission prompt.
  Its URL pattern was previously not working. (addshore)
* Update Logstash URL for Kibana 4 upgrade. (Bryan Davis)

## 1.5

### Added

* Insert footer link to find XHGui profile. (Ori Livneh)
* Insert footer link to find Kibana-Logstash logs. (Ori Livneh)

## 1.4

### Added

* Add new "Profile" option. (Ori Livneh)
* Add new "Read only" option. (Ori Livneh)
* Add new "Log" option. (Ori Livneh)

## 1.3

### Added

* Add option to select from multiple backends. (Ori Livneh)

## 1.1

### Added

* Add 15-min timer to automatically shut off. (Ori Livneh)
* Add URL pattern for `wikidata.org`. (Marius Hoch)

## 1.0

Initial release by Ori Livneh, 7 January 2015.
