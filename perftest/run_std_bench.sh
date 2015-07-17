#!/bin/bash

LOGDIR='./benchmark_logs'
SUMMARYFILENAME="All-runs-summary.txt"
NODE='node';
DEPLOYMENT='test';

usage () {
  echo "Optional:";
  echo "-E  deployment";
  echo "-l  log dir";
  echo "-n  node.js executable path";
  echo "-s  summary file";
}

options=":c:l:m:n:s:";
while getopts $options option; do
  case $option in
      E  ) DEPLOYMENT=$OPTARG;;
      l  ) LOGDIR=$OPTARG;;
      n  ) NODE=$OPTARG;;
      s  ) SUMMARYFILENAME=$OPTARG;;
      h  ) usage; exit;;
      \? ) echo "Unknown option: -$OPTARG" >&2; exit 1;;
      :  ) echo "Missing option argument for -$OPTARG" >&2; exit 1;;
      *  ) echo "Unimplimented option: -$OPTARG" >&2; exit 1;;
  esac
done

REVNO=`git log -n 1 --pretty=%h`   ## = "bzr revno"
[ -d $LOGDIR ] || mkdir $LOGDIR
SUMMARYFILE="$LOGDIR/$SUMMARYFILENAME"

DoRun() {
  ADAPTER=$1
  TIME=`date +%d%b%Y-%H%M%S`
  LOGFILE="$LOGDIR/git-$REVNO-$ADAPTER-$TIME.txt"
  Echo "Running $ADAPTER"
  OPTS1="--expose-gc jscrund --adapter=$ADAPTER --modes=indy,bulk -r 8"
  OPTS2="-E $DEPLOYMENT"
  ${NODE} $OPTS1 $OPTS2 | tee $LOGFILE
} 

Sum() {
  echo "## git: $REVNO  Adapter: $ADAPTER  Date: $TIME"
  tail $LOGFILE | Analyze
  echo ""
}


Analyze() {
  awk '
    func summarize() { for(i = 2 ; i < 8 ; i++) sums[i] += $i } 

    NR == 1 { print }
    NR == 7 { print; summarize(); }
    NR == 8 { print; summarize(); }
    NR == 9 { print; summarize(); }
    END     { printf("AVGS\t")
              for(i = 2 ; i < 8 ; i++) printf("%.1f\t", sums[i]/3);
              printf("\n")
              printf("TOTAL\tindy\t%d\n", sums[2]+sums[3]+sums[4])
              printf("TOTAL\tbulk\t%d\n", sums[5]+sums[6]+sums[7])
            } 
  '
}

DoRun ndb 
Sum | tee -a $SUMMARYFILE

DoRun mysql
Sum | tee -a $SUMMARYFILE

