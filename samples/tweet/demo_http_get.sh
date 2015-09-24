#
#
# Before running these, start the tweet.js app as a web server:
#
#       node tweet start server 7800
#
#

# Some sample queries that use curl to demonstrate the REST Tweet API:

# Get tweets @agrippina
curl http://localhost:7800/tweets-at/agrippina

# Get tweets about #carthage
curl http://localhost:7800/tweets-about/carthage

# There are no tweets about #aqueduct
curl http://localhost:7800/tweets-about/aqueduct

# Nero can use the API to post a tweet about his aqueduct:
curl http://localhost:7800/tweet/nero -d \
   'help! my #aqueduct has run dry again! @uncle_claudius!'

# Query again to see the new tweet:
curl http://localhost:7800/tweets-about/aqueduct
curl http://localhost:7800/tweets-at/uncle_claudius
