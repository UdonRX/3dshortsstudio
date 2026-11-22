    loadModel: async (file: File) => {
      const data = await file.arrayBuffer();
      const gltf = await new Promise<{ scene: THREE.Group }>((resolve, reject) => {
        gltfLoader.parse(data, '', (value) => resolve(value), (error) => reject(error));
      });
      const model = gltf.scene;
      const bounds = new THREE.Box3().setFromObject(model);
      const size = bounds.getSize(new THREE.Vector3());
      const maxDimension = Math.max(size.x, size.y, size.z) || 1;
      model.scale.setScalar(2.2 / maxDimension);
      const scaledBounds = new THREE.Box3().setFromObject(model);
      model.position.y -= scaledBounds.min.y;
      model.position.x = (importedModels.children.length % 3 - 1) * 1.1;
      model.position.z = 0.8;
      importedModels.add(model);
    },
    clearImportedModels: () => {
      for (const child of [...importedModels.children]) {
        importedModels.remove(child);
        child.traverse((object) => {
          if (object instanceof THREE.Mesh) {
            object.geometry.dispose();
            const materials = Array.isArray(object.material) ? object.material : [object.material];
            materials.forEach((material) => material.dispose());
          }
        });
      }
    },
    loadModel:async(file,resources,category='other')=>{const urls:string[]=[];const manager=new THREE.LoadingManager();if(resources?.size)manager.setURLModifier(url=>{const clean=decodeURIComponent(url).replace(/^.*?(?=\/)/,'').replace(/^\//,'');const tail=url.split('/').pop()??url;const blob=resources.get(clean)??resources.get(url)??resources.get(tail);if(blob){const u=URL.createObjectURL(blob);urls.push(u);return u;}return url;});const loader=new GLTFLoader(manager);const data=await file.arrayBuffer();const gltf=await new Promise<{scene:THREE.Group;animations:THREE.AnimationClip[]}>( (resolve,reject)=>loader.parse(data,'',resolve,reject));urls.forEach(URL.revokeObjectURL);const root=new THREE.Group();root.name=file.name;root.userData.category=category;const model=gltf.scene;root.add(model);const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3()),max=Math.max(size.x,size.y,size.z)||1;model.scale.setScalar(2.2/max);const scaled=new THREE.Box3().setFromObject(model);model.position.y-=scaled.min.y;root.position.x=(modelRecords.length%3-1)*1.1;root.position.z=.8;importedModels.add(root);modelRecords.push({root,mixer:gltf.animations.length?new THREE.AnimationMixer(model):undefined,clips:gltf.animations});},
    setModelTransform:(i,p,r,scale)=>{const rec=modelRecords[i];if(rec){rec.root.position.set(...p);rec.root.rotation.set(...r);rec.root.scale.setScalar(scale);}},
    removeModel:i=>{const rec=modelRecords[i];if(!rec)return;rec.mixer?.stopAllAction();importedModels.remove(rec.root);rec.root.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();const mats=Array.isArray(o.material)?o.material:[o.material];mats.forEach(m=>m.dispose());}});modelRecords.splice(i,1);},
    getModelAnimations:i=>modelRecords[i]?.clips.map(c=>c.name||'Animation')??[],
    setModelAnimation:(i,clipIndex)=>{const rec=modelRecords[i];if(!rec?.mixer)return;rec.action?.stop();rec.action=clipIndex>=0?rec.mixer.clipAction(rec.clips[clipIndex]):undefined;rec.action?.reset().play();},
    setModelAnimationPlaying:(i,value)=>{const rec=modelRecords[i];if(rec?.action)rec.action.paused=!value;},
    clearImportedModels:()=>{for(let i=modelRecords.length-1;i>=0;i--){const rec=modelRecords[i];rec.mixer?.stopAllAction();importedModels.remove(rec.root);rec.root.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();const mats=Array.isArray(o.material)?o.material:[o.material];mats.forEach(m=>m.dispose());}});}modelRecords.length=0;},
