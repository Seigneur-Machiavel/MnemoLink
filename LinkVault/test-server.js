// Importer le module HTTP intégré de Node.js
const http = require('http');
const fs = require('fs');
const path = require('path');

// Créer un serveur HTTP
http.createServer(function (request, response) {
    // Construire le chemin du fichier en fonction de la requête URL
    let filePath = './chrome-extension' + request.url;
    if (request.url == '/') {
        filePath = './chrome-extension/views/index.html'; // Spécifiez votre fichier HTML par défaut ici
    }

    // Extraire l'extension du fichier pour déterminer le bon type de contenu
    let extname = String(path.extname(filePath)).toLowerCase();
    let mimeTypes = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        // Ajoutez d'autres types MIME si nécessaire
    };

    // Défaut à text/plain si le type MIME n'est pas connu
    let contentType = mimeTypes[extname] || 'text/plain';

    // Lire le fichier du système de fichiers
    fs.readFile(filePath, function(error, content) {
        if (error) {
            if(error.code == 'ENOENT') {
                // Page non trouvée
                response.writeHead(404, { 'Content-Type': 'text/html' });
                response.end('404: File Not Found', 'utf-8');
            } else {
                // Erreur serveur
                response.writeHead(500);
                response.end('Sorry, check with the site admin for error: '+error.code+' ..\n');
            }
        } else {
            // Succès : envoyer le contenu du fichier
            response.writeHead(200, { 'Content-Type': contentType });
            response.end(content, 'utf-8');
        }
    });

}).listen(8080); // Le serveur écoute sur le port 8080

console.log('Server running at http://localhost:8080/');