(function () {
  const logZone = document.createElement('pre');
  logZone.style.cssText = "position:fixed; bottom:0; left:0; max-height:50%; overflow:auto; background:#000; color:#0f0; font-size:12px; z-index:9999; padding:5px;";
  document.body.appendChild(logZone);

  const write = (type, args) => {
    const msg = [...args].map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ');
    logZone.textContent += `[${type}] ${msg}\n`;
    logZone.scrollTop = logZone.scrollHeight;
  };

  ['log', 'warn', 'error'].forEach(type => {
    const original = console[type];
    console[type] = (...args) => {
      write(type, args);
      original.apply(console, args);
    };
  });
})();

const app = new Framework7({
  // App root element
  el: '#app',
  // App Name
  name: 'Mes frais',
  // App default theme
  theme: 'auto',
  // App DarkMode
  darkMode: 'auto',
  // Add default routes
  routes: [],
  // ... other parameters
});

let cropper;
const popup = app.popup.create({ el: '#crop-popup' });

document.getElementById('photo-input').addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    const img = document.getElementById('crop-image');
    img.src = reader.result;

    img.onload = () => {
      if (cropper) cropper.destroy();

      if (typeof cv !== 'undefined') {
        // OpenCV déjà chargé
        //detectTicketContour(img, (rect) => {
        docDetection(img, (rect) => {
          cropper = new Cropper(img, {
            viewMode: 1,
            data: rect ? {
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height
            } : undefined
          });
          popup.open();
        });
      } else {
        console.log('fallback');
        // Fallback sans OpenCV
        cropper = new Cropper(img, {
          viewMode: 1
        });
        popup.open();
      }
    };
  };
  reader.readAsDataURL(file);
});

function detectTicketContour(imageEl, callback) {
  try {
    const src = cv.imread(imageEl);
    const original = src.clone();

    // Resize
    const maxWidth = 800;
    if (src.cols > maxWidth) {
      const scale = maxWidth / src.cols;
      const newSize = new cv.Size(src.cols * scale, src.rows * scale);
      cv.resize(src, src, newSize);
    }

    // Gris + amélioration contraste
    cv.cvtColor(src, src, cv.COLOR_RGBA2GRAY, 0);
    //const clahe = new cv.createCLAHE(2.0, new cv.Size(8, 8));
    //clahe.apply(src, src);
    cv.equalizeHist(src, src);

    // Flou + Canny
    cv.GaussianBlur(src, src, new cv.Size(5, 5), 0);
    const edges = new cv.Mat();
    cv.Canny(src, edges, 50, 150);

    // Recherche contours
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    let biggest = null;
    let maxArea = 0;

    for (let i = 0; i < contours.size(); i++) {
      const cnt = contours.get(i);
      const peri = cv.arcLength(cnt, true);
      const approx = new cv.Mat();
      cv.approxPolyDP(cnt, approx, 0.02 * peri, true);
      const area = cv.contourArea(cnt);

      if (approx.rows === 4 && area > maxArea && cv.isContourConvex(approx)) {
        maxArea = area;
        biggest = cv.boundingRect(approx);
      }

      approx.delete();
    }

    callback(biggest || null);

    // Nettoyage mémoire
    src.delete(); original.delete(); edges.delete();
    contours.delete(); hierarchy.delete(); //clahe.delete();
  } catch (err) {
    console.error("Erreur OpenCV :", err.message);
    callback(null);
  }
}

document.getElementById('validate-crop').addEventListener('click', async () => {
  const canvas = cropper.getCroppedCanvas();
  popup.close();
  cropper.destroy();

  const imagePreview = document.getElementById('preview-container');
  imagePreview.innerHTML = `<img src="${canvas.toDataURL()}" style="max-width: 100%; margin-top: 1rem;" />`;

  app.dialog.preloader('Analyse de l’image...');
  try {
    const result = await Tesseract.recognize(canvas.toDataURL(), 'fra');
    app.dialog.close();

    const text = result.data.text;
    console.log("Texte OCR :", text);
    // const match = text.match(/(?:total\\s*(?:ttc)?|montant\\s*(?:à\\s*payer)?)[^\\d]{0,10}([\\d\\s,.]+)/i);
    // const montant = match ? match[1].trim() : null;
    const montantRegex = /(\d+[.,]\d{2})/g;
    const montants = text.match(montantRegex);
    const montant = montants ? montants[montants.length - 1] : null;
    console.log(montants)
    
    if (montant) {
      app.dialog.alert(`Montant TTC détecté : ${montant}`, 'OCR réussi');
    } else {
      app.dialog.alert('Aucun montant TTC détecté', 'OCR échoué');
    }
  } catch (err) {
    app.dialog.close();
    console.error("Erreur OCR :", err);
    app.dialog.alert("Erreur lors de l’analyse OCR.", "Erreur");
  }
});

document.getElementById('photo-btn').addEventListener('click', () => {
  document.getElementById('photo-input').click();
});

// détection de document dans une photo
function docDetection(imgElement, callback) {
    // 1. Charger l'image dans un Mat OpenCV
    const src = cv.imread(imgElement);
    const original = src.clone();
    // cv.imshow('canvasOutput', original); // Afficher l'image originale

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
    
    console.log(JSON.stringify(cv));

    if (biggestContour) {
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

        let rect = { x: tl.x, y: tl.y, width: maxWidth, height: maxHeight};
        callback(rect || null)

        // Libérer la mémoire
        srcMat.delete();
        dstMat.delete();
        transformMatrix.delete();
        warped.delete();
        biggestContour.delete();
    } else {
        console.warn("Aucun contour de document trouvé.");
        callback(null);
    }

    // Libérer la mémoire des matrices principales
    src.delete();
    gray.delete();
    blurred.delete();
    edged.delete();
    contours.delete();
    hierarchy.delete();
}