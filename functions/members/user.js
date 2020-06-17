const {admin , db} = require("../config/admin");
const config = require("../config/conf");
const {valdsignup,valdlogin} = require("../config/validate");
const firebase = require('firebase');
firebase.initializeApp(config);

// Signup = สมัครสมาชิก
    exports.signup =     (req,res)=>{
        const newUser = {
            email : req.body.email,
            password :req.body.password,
            confirmpassword : req.body.confirmpassword,
            handle  : req.body.handle
        };
        // เช็คการกรอกข้อมูล
        const {valid,errors} = valdsignup(newUser);
        if (!valid) return res.status(400).json(erros);
        let token,userId;
        
        //ใส่รูปโปรไฟล์เปล่า ๆ 
        const noimg = 'pf.png';
        
        db.doc(`/members/${newUser.handle}`).get()
            .then(doc=>{
                if (doc.exists){
                    return res.status(400).json({handle : 'hd taken'});
                }else {
                    return firebase 
                    .auth().createUserWithEmailAndPassword(newUser.email,newUser.password)
                }
        })
            .then(data => {
                userId = data.user.uid;
                return data.user.getIdToken();

            })  
            .then(idToken =>{
                token = idToken ;
                const userCredentials = {
                    handle: newUser.handle,
                    email : newUser.email,
                    createAt: new Date().toISOString(),
                    imageurl : `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${noimg}?alt=media` ,
                    userId

                };
                db.doc(`/members/${newUser.handle}`).set(userCredentials);

            }) 
            .then(()=>{
                return res.status(201).json({token});
            })
            .catch(err=>{
                if (err.code === 'auth/email-already-in-use'){
                    return res.status(400).json ({email: 'email has used'})
                }
                console.error(err);
                return res.status(500).json({error : 'boom'});
            })     
        };

    // Login = ลงชื่อเข้าใช้
        exports.login = (req,res)=>{
            const user = {
                email : req.body.email,
                password : req.body.password
            };
            const {valid,errors} = valdlogin(user);
            if (!valid) return res.status(400).json(erros);
            firebase
            .auth()
            .signInWithEmailAndPassword(user.email,user.password)
            .then(data=>{
                return data.user.getIdToken();
            })
            .then(token=>{
                return res.json({token});
            })
            .catch((err)=>{
                if(err.code === 'auth/wrong-password'){
                    return res.status(403).json({general : 'wrong data,try again'});
                }else return res.status(500).json({error: err.code});
                return res.status(500).json({error: err.code});
            })
        };

    // อัพรุูปโปรไฟล์
    exports.uploadimage = (req,res) =>{
        const Busboy = require('busboy');
        const path = require('path');
        const os = require('os');
        const fs = require('fs');
        const busboy = new Busboy({headers : req.headers});

        let imagename;
        let imageUpload = {};

        busboy.on('file',(fieldname,file,filename ,encoding,mimetype)=>{
            let imagename;
            let imageUpload = {};
            console.log(fieldname);
            console.log(filename);
            console.log(mimetype);
            const imageExten = filename.split('.')[filename.split('.').length -1];
            imagename = `${Math.round(Math.random()*100000000000)}.${imageExten}`;
            const filepath = path.join(os.tmpdir(),imagename);
            imageUpload = {filepath,mimetype};
            file.pipe(fs.createWriteStream(filepath));
        });
        busboy.on('finish',()=>{
            admin.storage().bucket().upload(imageUpload.filepath,{
                resumable : false,
                metadata : {
                    metadata : {
                        contentType : imageUpload.mimetype
                    }
                }
            })
            .then(()=>{
                const imageurl = `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${imagename}?alt=media`;
                return db.doc(`/members/${req.user.handle}`).update({imageurl});
            })
            .then(()=> {
                return res.json({message : 'upload success'});
            })
            .catch(err=>{
                console.error(err)
                return res.status(500).json({error:err.code});
            })
        })
        busboy.end(req.rawBody);

    }
    