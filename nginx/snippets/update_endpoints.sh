#!/bin/bash
set -e

ig_name=go-webrtmp-ig-ue1
output_file=/etc/nginx/snippets/webrtmp-group-ips.conf

function get_endpoints() {
	set -e

	instances=$(gcloud compute instance-groups list-instances $ig_name --region=us-east1 --uri)

	for inst in $instances; do
		# echo $inst
		ip=$(gcloud compute instances describe $inst --format='get(networkInterfaces[0].networkIP)')
		echo "server $ip:80;" 
	done
}

echo Fetching endpoints from instance group $ig_name...
endpoints=$(get_endpoints $1)

if echo "$endpoints" | cmp -s - "$output_file"; then
	echo "Endpoints already updated"
else
	echo "Writing endpoints to file $output_file"
	echo "Endpoints:"
	echo "$endpoints"

	echo "$endpoints" > "$output_file"
fi

echo Testing nginx config...
if service nginx configtest; then
	echo Reloading...
	service nginx reload
	echo Success!
else
	nginx -t
fi
