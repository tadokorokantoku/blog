// Records the scene in real time and uploads the WebM back to the driver.

function run() {
  const render = RENDERERS[sceneData.type];

  const recorder = new MediaRecorder(canvas.captureStream(fps), { mimeType: 'video/webm; codecs=vp8', videoBitsPerSecond: 12000000 });
  const chunks = [];
  recorder.ondataavailable = e => chunks.push(e.data);
  recorder.onstop = async () => {
    await fetch('/upload?id=' + sceneData.id, { method: 'POST', body: new Blob(chunks, { type: 'video/webm' }) });
    window.close();
  };
  recorder.start();

  let t0 = null;
  function loop(now) {
    if (t0 === null) t0 = now;
    const t = (now - t0) / 1000;
    drawProceduralBackground(t);
    drawHeader();
    ctx.save();
    render(t);
    ctx.restore();
    drawFooter(t);
    if (t < duration) requestAnimationFrame(loop);
    else recorder.stop();
  }
  requestAnimationFrame(loop);
}

run();
