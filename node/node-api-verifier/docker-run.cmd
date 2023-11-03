docker run --rm -it -p 8080:8080 ^
    -e CONFIGFILE=./config.json ^
    -e PRESENTATIONFILE=./presentation_request_config.json ^
    node-aadvc-api-idtokenhint:latest