// Fonction à exécuter une fois qu'OpenCV.js est chargé et prêt
function onOpenCvReady() {
    console.log('OpenCV.js est prêt.');
    // Désactive l'input file tant qu'OpenCV n'est pas prêt
    document.getElementById('fileInput').disabled = false;
}

// Lier l'événement 'change' de l'input file
const inputElement = document.getElementById('fileInput');
inputElement.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            const imgElement = document.createElement('img');
            imgElement.src = event.target.result;
            imgElement.onload = function() {
                processImage(imgElement);
            };
        };
        reader.readAsDataURL(file);
    }
});

function processImage(imgElement) {
    // 1. Charger l'image dans un Mat OpenCV
    const src = cv.imread(imgElement);
    const original = src.clone();
    cv.imshow('canvasOutput', original); // Afficher l'image originale

    // 2. Prétraitement de l'image
    const gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);

    const blurred = new cv.Mat();
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT);

    const edged = new cv.Mat();
    cv.Canny(blurred, edged, 75, 200);

    // 3. Trouver les contours
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(edged, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

    // 4. Trouver le plus grand contour (supposé être le document)
    let maxArea = 0;
    let biggestContour = null;

    for (let i = 0; i < contours.size(); ++i) {
        const contour = contours.get(i);
        const area = cv.contourArea(contour, false);

        if (area > maxArea) {
            const peri = cv.arcLength(contour, true);
            const approx = new cv.Mat();
            cv.approxPolyDP(contour, approx, 0.02 * peri, true);

            // On suppose que le document est un quadrilatère
            if (approx.rows === 4 && area > 1000) { // Le seuil de 1000 pixels évite les petits contours
                maxArea = area;
                biggestContour = approx;
            } else {
                approx.delete();
            }
        }
        contour.delete();
    }
    
    if (biggestContour) {
        // Dessiner le contour trouvé sur une copie de l'image
        const contoursCanvas = original.clone();
        const color = new cv.Scalar(0, 255, 0, 255); // Vert
        cv.drawContours(contoursCanvas, contours, contours.size() -1, color, 2, cv.LINE_8, hierarchy, 100);
        cv.imshow('canvasContours', contoursCanvas);
        contoursCanvas.delete();
        

        // 5. Appliquer la transformation de perspective
        const points = [];
        for (let i = 0; i < biggestContour.rows; i++) {
            points.push({ x: biggestContour.data32S[i * 2], y: biggestContour.data32S[i * 2 + 1] });
        }

        // Ordonner les points : haut-gauche, haut-droite, bas-droite, bas-gauche
        points.sort((a, b) => a.y - b.y);
        const topPoints = points.slice(0, 2).sort((a, b) => a.x - b.x);
        const bottomPoints = points.slice(2, 4).sort((a, b) => a.x - b.x);

        const orderedPoints = [topPoints[0], topPoints[1], bottomPoints[1], bottomPoints[0]];

        const [tl, tr, br, bl] = orderedPoints;

        // Calculer la largeur et la hauteur de la nouvelle image
        const widthA = Math.sqrt(Math.pow(br.x - bl.x, 2) + Math.pow(br.y - bl.y, 2));
        const widthB = Math.sqrt(Math.pow(tr.x - tl.x, 2) + Math.pow(tr.y - tl.y, 2));
        const maxWidth = Math.max(widthA, widthB);

        const heightA = Math.sqrt(Math.pow(tr.x - br.x, 2) + Math.pow(tr.y - br.y, 2));
        const heightB = Math.sqrt(Math.pow(tl.x - bl.x, 2) + Math.pow(tl.y - bl.y, 2));
        const maxHeight = Math.max(heightA, heightB);

        // Définir les points source et destination pour la transformation
        const srcMat = cv.matFromArray(4, 1, cv.CV_32FC2, [tl.x, tl.y, tr.x, tr.y, br.x, br.y, bl.x, bl.y]);
        const dstMat = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, maxWidth, 0, maxWidth, maxHeight, 0, maxHeight]);

        // Obtenir la matrice de transformation et appliquer la déformation
        const transformMatrix = cv.getPerspectiveTransform(srcMat, dstMat);
        const warped = new cv.Mat();
        const dsize = new cv.Size(maxWidth, maxHeight);
        cv.warpPerspective(original, warped, transformMatrix, dsize, cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());

        cv.imshow('canvasScanned', warped);

        // Libérer la mémoire
        srcMat.delete();
        dstMat.delete();
        transformMatrix.delete();
        warped.delete();
        biggestContour.delete();
    } else {
        console.warn("Aucun contour de document trouvé.");
        // Nettoyer les canvas si aucun document n'est trouvé
        const canvasContours = document.getElementById('canvasContours');
        const canvasScanned = document.getElementById('canvasScanned');
        canvasContours.getContext('2d').clearRect(0, 0, canvasContours.width, canvasContours.height);
        canvasScanned.getContext('2d').clearRect(0, 0, canvasScanned.width, canvasScanned.height);
    }

    // Libérer la mémoire des matrices principales
    src.delete();
    gray.delete();
    blurred.delete();
    edged.delete();
    contours.delete();
    hierarchy.delete();
}
