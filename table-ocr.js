// SPDX-License-Identifier: GPL-3.0-only
// Remove long table rules from the temporary OCR canvas, never from the stored photo.
export function removeTableRules(canvas){
 const context=canvas.getContext('2d'),image=context.getImageData(0,0,canvas.width,canvas.height),{data,width,height}=image;
 const rows=[],columns=[],dark=(x,y)=>{const i=(y*width+x)*4;return data[i]+data[i+1]+data[i+2]<600;};
 for(let y=0;y<height;y++){let count=0;for(let x=0;x<width;x++)if(dark(x,y))count++;if(count>width*.75)rows.push(y);}
 for(let x=0;x<width;x++){let count=0;for(let y=0;y<height;y++)if(dark(x,y))count++;if(count>height*.65)columns.push(x);}
 if(rows.length<4||columns.length<4)return canvas;
 const clear=(x,y)=>{if(x<0||y<0||x>=width||y>=height)return;const i=(y*width+x)*4;data[i]=data[i+1]=data[i+2]=255;};
 for(const y of rows)for(let delta=-1;delta<=1;delta++)for(let x=0;x<width;x++)clear(x,y+delta);
 for(const x of columns)for(let delta=-1;delta<=1;delta++)for(let y=0;y<height;y++)clear(x+delta,y);
 context.putImageData(image,0,0);return canvas;
}

