
/* To customize jscrund behavior, rename this file to jscrund.config and edit here.
   Properties on the command line override these options.
*/


/* jscrund options
 */
exports.options = {
  'adapter'       : 'ndb',
  'database'      : 'jscrund',
  'modes'         : 'indy,each,bulk',
  'tests'         : 'persist,find,remove',
  'iterations'    : 4000,
  'stats'         : false
};

