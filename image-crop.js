// SPDX-License-Identifier: GPL-3.0-only
// Coordinates stay relative to the original preview, including on narrow screens.
export function cropBounds(start,end){
 const clamp=n=>Math.max(0,Math.min(1,n));
 const x=Math.min(clamp(start.x),clamp(end.x)),y=Math.min(clamp(start.y),clamp(end.y));
 return {x,y,width:Math.abs(clamp(end.x)-clamp(start.x)),height:Math.abs(clamp(end.y)-clamp(start.y))};
}
export function cropForOCR(source,selection,preprocess=canvas=>canvas){
 const x=Math.floor(selection.x*source.width),y=Math.floor(selection.y*source.height);
 const width=Math.max(1,Math.min(source.width-x,Math.round(selection.width*source.width)));
 const height=Math.max(1,Math.min(source.height-y,Math.round(selection.height*source.height)));
 // Small table text needs enough pixels for the local OCR model.
 const scale=Math.min(2,Math.max(1,2400/Math.max(width,height)));
 const cropped=document.createElement('canvas');cropped.width=width;cropped.height=height;
 const croppedContext=cropped.getContext('2d');croppedContext.fillStyle='#fff';croppedContext.fillRect(0,0,width,height);croppedContext.drawImage(source,x,y,width,height,0,0,width,height);
 const prepared=preprocess(cropped);
 const canvas=document.createElement('canvas');canvas.width=Math.round(width*scale);canvas.height=Math.round(height*scale);
 const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);
 context.drawImage(prepared,0,0,canvas.width,canvas.height);return canvas;
}
export function setupImageCrop(host){
 host.innerHTML='<p>Ziehe mit dem Finger oder der Maus einen Rahmen um die Tabelle. Alle fünf Spalten müssen im Ausschnitt bleiben. Alternativ die Ränder in Prozent einstellen.</p><canvas class="crop-preview" aria-label="Foto: Rahmen um die gewünschte Tabelle ziehen"></canvas><div class="crop-edges">'+[['left','Links'],['top','Oben'],['right','Rechts'],['bottom','Unten']].map(([key,label])=>`<label>${label} (%)<input type="number" data-edge="${key}" min="0" max="100" step="1" value="${key==='right'||key==='bottom'?100:0}"></label>`).join('')+'</div><button type="button" class="secondary crop-reset">Ganzes Foto auswählen</button><p class="hint crop-size" role="status"></p>';
 const preview=host.querySelector('canvas'),context=preview.getContext('2d');
 let source=null,selection={x:0,y:0,width:1,height:1},start=null;
 function draw(){
  if(!source)return;context.drawImage(source,0,0,preview.width,preview.height);
  const x=selection.x*preview.width,y=selection.y*preview.height,w=selection.width*preview.width,h=selection.height*preview.height;
  context.fillStyle='#0008';context.beginPath();context.rect(0,0,preview.width,preview.height);context.rect(x,y,w,h);context.fill('evenodd');
  context.strokeStyle='#0078d4';context.lineWidth=3;context.strokeRect(x,y,w,h);
  const values={left:selection.x,top:selection.y,right:selection.x+selection.width,bottom:selection.y+selection.height};
  for(const input of host.querySelectorAll('input'))input.value=Math.round(values[input.dataset.edge]*100);
  host.querySelector('.crop-size').textContent=`Ausschnitt: ${Math.round(selection.width*source.width)} × ${Math.round(selection.height*source.height)} Pixel. Anschließend „Ausschnitt lesen“ wählen.`;
 }
 function point(event){const box=preview.getBoundingClientRect();return {x:(event.clientX-box.left)/box.width,y:(event.clientY-box.top)/box.height};}
 preview.onpointerdown=event=>{if(!source)return;start=point(event);preview.setPointerCapture(event.pointerId);};
 preview.onpointermove=event=>{if(start){selection=cropBounds(start,point(event));draw();}};
 preview.onpointerup=event=>{if(!start)return;const next=cropBounds(start,point(event));start=null;if(next.width*source.width>=10&&next.height*source.height>=10)selection=next;else selection={x:0,y:0,width:1,height:1};draw();};
 preview.onpointercancel=()=>{start=null;selection={x:0,y:0,width:1,height:1};draw();};
 host.querySelector('.crop-reset').onclick=()=>{selection={x:0,y:0,width:1,height:1};draw();};
 host.onchange=event=>{if(!event.target.matches('input'))return;const values=Object.fromEntries([...host.querySelectorAll('input')].map(input=>[input.dataset.edge,Number(input.value)/100]));const next=cropBounds({x:values.left,y:values.top},{x:values.right,y:values.bottom});if(next.width>0&&next.height>0)selection=next;draw();};
 return {load(canvas){source=canvas;selection={x:0,y:0,width:1,height:1};preview.width=Math.min(1000,canvas.width);preview.height=Math.max(1,Math.round(canvas.height*preview.width/canvas.width));host.hidden=false;draw();},canvas:preprocess=>cropForOCR(source,selection,preprocess),clear(){source=null;start=null;host.hidden=true;}};
}
