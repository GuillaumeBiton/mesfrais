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
      if (cropper) cropper.destroy(); // détruire l’ancien si nécessaire
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
  };
  reader.readAsDataURL(file);
});

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

function detectTicketContour(imageEl, callback) {
  const src = cv.imread(imageEl);
  const dst = new cv.Mat();
  cv.cvtColor(src, src, cv.COLOR_RGBA2GRAY, 0);
  cv.GaussianBlur(src, src, new cv.Size(5, 5), 0);
  cv.Canny(src, dst, 50, 150);

  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  cv.findContours(dst, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

  let biggestContour = null;
  let maxArea = 0;
  for (let i = 0; i < contours.size(); i++) {
    const cnt = contours.get(i);
    const area = cv.contourArea(cnt);
    if (area > maxArea) {
      maxArea = area;
      biggestContour = cnt;
    }
  }

  if (biggestContour) {
    const rect = cv.boundingRect(biggestContour);
    callback(rect); // rect.x, rect.y, rect.width, rect.height
  } else {
    callback(null);
  }

  // nettoyage
  src.delete(); dst.delete(); contours.delete(); hierarchy.delete();
}
