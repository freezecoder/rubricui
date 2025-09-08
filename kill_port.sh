
#port=$1

for port in $@;do
echo $port
pid=`lsof -ti:$port`
#echo kill -9 $(lsof -ti:${port})

 kill -9 $pid

done
