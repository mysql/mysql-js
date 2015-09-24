# Some sample queries using the command line


# Get tweets that mention @agrippina
node tweet get tweets-at agrippina

# Get tweets with hashtag #carthage
node tweet get tweets-about carthage

# Get tweets written by Nero
node tweet get tweets-by nero

# Get the five most recent tweets
node tweet get tweets-recent 5

# Nobody follows Claudius
node tweet get followers uncle_claudius

# See who Agrippina follows
node tweet get following agrippina
