# This script populates the sample database

# Create four users: Caligula, Claudius, Nero, Agrippina
#
node tweet put user caligula 'Gaius Julius Casear Germanicus'
node tweet put user uncle_claudius 'Tiberius Claudius Nero Germanicus'
node tweet put user nero 'Lucius Domitius Ahenobarus'
node tweet put user agrippina 'Julia Augusta Agrippina Minor'


# Create follow records: Nero follows Agrippina, etc.
#
node tweet put follow nero agrippina
node tweet put follow agrippina nero
node tweet put follow agrippina uncle_claudius
node tweet put follow agrippina caligula


# Now post some tweets from each user
#
node tweet post tweet caligula '@agrippina You really are my favorite sister.'
node tweet post tweet agrippina '@nero Remember to be nice to Uncle Claudius!' 
node tweet post tweet nero 'I love to sing!'
node tweet post tweet nero 'I am the best #poet and the best #gladiator!'
node tweet post tweet agrippina \
 '@uncle_claudius Please come over for dinner, we have some fantastic #mushrooms'
node tweet post tweet uncle_claudius 'I am writing a new history of #carthage'
node tweet post tweet caligula '@agrippina you are my worst sister! worst!' 
node tweet post tweet caligula '@agrippina Rome is terrible!!!'
