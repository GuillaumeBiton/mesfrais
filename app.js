const app = new Framework7({
  // App root element
  el: '#app',
  // App Name
  name: 'Mes frais',
  // App default theme
  theme: 'auto',
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
        detectTicketContour(img, (rect) => {
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
    const clahe = new cv.createCLAHE(2.0, new cv.Size(8, 8));
    clahe.apply(src, src);

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
    contours.delete(); hierarchy.delete(); clahe.delete();
  } catch (err) {
    console.error("Erreur OpenCV :", err);
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
