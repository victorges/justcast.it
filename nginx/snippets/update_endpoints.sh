#!/bin/bash
set -e

ig_name=go-webrtmp-ig-ue1
output_file=/etc/nginx/snippets/webrtmp-group-ips.conf

function log() {
	echo "[$(date -Isecond)]" $@
}

function get_endpoints() {
	set -e

	instances=$(gcloud compute instance-groups list-instances $ig_name --region=us-east1 --uri)

	for inst in $instances; do
		# echo $inst
		ip=$(gcloud compute instances describe $inst --format='get(networkInterfaces[0].networkIP)')
		echo "server $ip:80;" 
	done
}

log Fetching endpoints from instance group $ig_name...
endpoints=$(get_endpoints $1)

if echo "$endpoints" | cmp -s - "$output_file"; then
	log "Endpoints already updated"
else
	log "Writing endpoints to file $output_file"
	log "Endpoints:"
	log "$endpoints"

	echo "$endpoints" > "$output_file"
fi

log Testing nginx config...
if /usr/sbin/service nginx configtest; then
	log Reloading...
	/usr/sbin/service nginx reload
	log Success!
else
	log Failed!
	/usr/sbin/nginx -t
fi
