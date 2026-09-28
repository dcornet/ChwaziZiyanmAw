# # Loading Data
# source("/opt/shiny-server/samples/sample-apps/Projet_Rita/R/model.R",local = TRUE)

# 1. Duree d'emergence ----------------------
em<-ldf[["deme"]]
pla<-ldf[["dpla"]]

# Ajout du nombre de plants plantes au fichier d'emergence
plas<-dplyr::summarize(group_by(pla, AN, Parcelle, Var), 
                       Nb_Pl=sum(NB_P_Parc))
em<-dplyr::select(em, AN, Parcelle, Var, Plante, Date_Levee_JAP, NB_Lev_Billon)
em<-left_join(em, plas, by=c("AN", "Parcelle", "Var"))

# Preparation du tableau pour les PP
ems_pp<-subset(em, is.na(Plante))
ems_pp<-dplyr::summarise(group_by(ems_pp, AN, Parcelle, Var, Date_Levee_JAP),
                         Np=mean(Nb_Pl),
                         Nc=sum(NB_Lev_Billon))
ems_pp<-ems_pp[with(ems_pp, order(AN, Parcelle, Var, Date_Levee_JAP)), ]
ems_pp<-dplyr::mutate(group_by(ems_pp, AN, Parcelle, Var, Np),
                      Start=lag(round(Date_Levee_JAP)),
                      Start=ifelse(is.na(Start), 0, Start),
                      End=as.numeric(round(Date_Levee_JAP)))
ems_pp<-ems_pp %>% group_by(AN, Parcelle, Var, Np) %>% 
  do(data.frame(Nc= c(.$Nc, NA), Start= c(.$Start, NA), End= c(.$End, NA)))
ems_pp<-dplyr::mutate(group_by(ems_pp, AN, Parcelle, Var, Np),
                      Start=ifelse(is.na(Start), lag(End), Start),
                      End=ifelse(is.na(End), Inf, End),
                      Nc=ifelse(is.na(Nc), Np, Nc),
                      N=Nc-lag(Nc),
                      N=ifelse(is.na(N), Nc, N))

# Preparation du tableau pour les PR
ems_pr<-subset(em, !is.na(Plante) & !is.na(Date_Levee_JAP))
ems_pr<-dplyr::select(ems_pr, -NB_Lev_Billon)
ems_pr<-dplyr::summarize(group_by(ems_pr, AN, Parcelle, Var, Date_Levee_JAP), 
                         N=n(), Np=mean(Nb_Pl))
ems_pr<-ems_pr[with(ems_pr, order(AN, Parcelle, Var, Date_Levee_JAP)), ]
ems_pr<-dplyr::mutate(group_by(ems_pr, AN, Parcelle, Var, Np),
                      Nc=cumsum(N),
                      Start=lag(round(Date_Levee_JAP)),
                      Start=ifelse(is.na(Start), 0, Start),
                      End=as.numeric(round(Date_Levee_JAP)))
ems_pr<-dplyr::select(ems_pr, -Date_Levee_JAP)
ems_pr<-ems_pr %>% group_by(AN, Parcelle, Var, Np) %>% 
  do(data.frame(Nc=c(.$Nc, NA), Start=c(.$Start, NA), End=c(.$End, NA), 
                N=c(.$N, NA)))
ems_pr<-dplyr::mutate(group_by(ems_pr, AN, Parcelle, Var, Np),
                      Start=ifelse(is.na(Start), lag(End), Start),
                      End=ifelse(is.na(End), Inf, End),
                      Nc=ifelse(is.na(Nc), Np, Nc),
                      N=ifelse(is.na(N), Np-lag(Nc), N))

# Fusion des df
em<-rbind(ems_pr, ems_pp)

# Suppression des situations avec trop peu de données et ajout de 0,0
em<-dplyr::mutate(group_by(em, AN, Parcelle, Var), NbUniqEm=length(unique(Nc)),  Nx=last(N))
em<-subset(em, NbUniqEm>5)
em$cc<-paste(em$AN, em$Parcelle, em$Var, sep="_")
em$Start<-ifelse(em$Start==0, 5, em$Start)
em$N<-ifelse(em$End==Inf, 0, em$N)
em$N<-ifelse(em$End==Inf, 0, em$N)
em$End<-ifelse(em$End==Inf, 180, em$End)
em %>% group_by(cc) %>% do ({
  # extract and modify the first row
  firstRow <-lastRow<- .[1,]
  firstRow[c("Start", "End", "N")] <- c(0,5,0)
  lastRow[c("Start", "End", "N")] <- c(180,Inf,99999)
  # bind the first row with the sub data frame . represents a data frame with a unique subject_ID
  bind_rows(firstRow, ., lastRow)
})->em
em$N<-ifelse(em$N==99999, em$Nx, em$N)
em<-mutate(group_by(em, cc), Nc=cumsum(N))

# Ajustement des modeles aux 400 situations
ccv<-levels(as.factor(em$cc))
lm<-list()
i<-0
for (i in 1:length(levels(as.factor(em$cc)))) {
  tryCatch(expr={
    i<-i+1
    ems<-subset(em, cc==ccv[i])
    m<-drm(N~Start+End, cc, data=ems, fct=L.3(), type ="event",
           lowerl=c(-Inf, 0.1, 0), upperl=c(0,1,Inf),
           control = drmc(trace=F, maxIt=100000))
    lm<-c(lm, list(m))
    #return(lm)
  }, 
  error=function(e){
    # cat("ERROR :",i, conditionMessage(e), "\n")
    }, envir=parent.frame()
  )
}

# pdf("EMmodels.pdf")
# par(mfrow = c(6,3), mar=c(2,2,2,2))
# for (i in 1:length(lm)) {
#   plot(lm[[i]], main=colnames(lm[[i]]$parmMat))
# }
# dev.off()

# # Graph des modeles
# PlotModel<- function(fit) {
#     png(height=7, width=7, res=300, units="in",
#         filename=paste("./out/plotEm/", fit$dataList$curveid[1], ".png", sep=""))
#     plot(fit)
#     dev.off()
# }
# lapply(lm, PlotModel)


# # Suppression des modeles errones
# DeleteBadModel<- function(fit) {
#   ifelse(length(fit$predres)<7, NA, return(fit))
# }

#Extraire les infos utiles des modeles
ExtrModelInfo <- function(fit) {
  data.frame(code=paste0(dimnames(fit$indexMat)[2]),
             EM5=ED(fit, 5)[1], EM50=ED(fit, 50)[1],
             I5.1=ED(fit, 90)[1]-ED(fit, 10)[1],
             Slope=summary(fit)$coef[1],
             Emx=summary(fit)$coef[2],
             Tinflex=summary(fit)$coef[3])
}
#DeleteBadModel=get("DeleteBadModel")
#ExtrModelInfo = get("ExtrModelInfo")
# lm2<-lapply(lm, DeleteBadModel)
# lm2<-lm2[lapply(lm2,length)>1]
resEm = lapply(lm, ExtrModelInfo)
resEm=do.call(rbind, resEm)
resEm=separate(resEm, code, into=c("AN", "Parcelle", "Var"), sep="_")
resEm$AN=as.integer(resEm$AN)
resEm=left_join(comb, resEm, by=c("AN", "Parcelle", "Var"))
adv=dplyr::select(resEm, AN:Sp, I5.1)

# # Mise en graphique
# # Exemple avec trop peu de points
# lm[[212]]$dataList$curveid
# newdata<-expand.grid(Start=c(0:150))
# pm<-predict(lm[[212]], newdata=newdata, interval="confidence")
# newdata$p<-pm[,1]
# p1<-ggplot(subset(em, cc=="2014_Godet_KINABAYO"), aes(x = End, y = Nc/Np)) +
#     geom_point() + xlim(0,150)+ylim(0,1)+
#     geom_line(data=newdata, aes(x=Start, y=p))+
#     theme_bw(base_size = 20)+ylab("Taux d'émergence")+
#     xlab("Jours après plantation")+
#     ggtitle("Manque de données")
#
# # Exemple de non convergence du modèle
# p2<-ggplot(subset(em, cc=="2012_AB_KINABAYO"), aes(x = End, y = Nc/Np)) +
#     geom_point() +xlim(0,150)+ylim(0,1)+
#     # geom_line(data=newdata, aes(x=Start, y=p))+
#     theme_bw(base_size = 20)+ylab("Taux d'émergence")+
#     xlab("Jours après plantation")+
#     ggtitle("Non convergence")+
#     theme(axis.text.y = element_blank(),
#           axis.title.y = element_blank())
#
# # Exemple avec suffisament de point
# lm[[15]]$dataList$curveid
# newdata<-expand.grid(Start=c(0:150))
# pm<-predict(lm[[15]], newdata=newdata, interval="confidence")
# newdata$p<-pm[,1]
# p3<-ggplot(subset(em, cc=="2012_BA_KINABAYO"), aes(x = End, y = Nc/Np)) +
#     geom_point() +xlim(0,150)+ylim(0,1)+
#     geom_line(data=newdata, aes(x=Start, y=p))+
#     theme_bw(base_size = 20)+ylab("Taux d'émergence")+
#     xlab("Jours après plantation")+
#     ggtitle("Modèle correct")+
#     geom_segment(aes(y=.5, yend=.5, x=ED(lm[[15]], 5)[1],
#                       xend=ED(lm[[15]], 95)[1]), color="red", size=2,
#                  arrow = arrow(length = unit(0.5, "cm"), ends="both"))+
#     geom_text(aes(x=ED(lm[[15]], 95)[1],
#                   y=.45, label=paste("I5.1 : ",
#                                round(ED(lm[[15]], 95)[1]-ED(lm[[15]], 5)[1], 1),
#                                " jours", sep="")), color="red", size=10)+
#     theme(axis.text.y = element_blank(),
#           axis.title.y = element_blank())
#
# library(gridExtra)
#
# png(height=8, width=14, res=300, units="in", type="cairo",family="Garamond",
#     filename="I5.1.png")
# grid.arrange(p1, p2, p3, ncol=3)
# dev.off()


# 2. Recouvrement ----------------------
rec<-ldf[["drec"]]
rec<-rec[with(rec, order(AN, Parcelle, Var, Bloc, Date_Obs_pRec_JAP)), ]

# Suppression des situations avec trop peu de données ou d'amplitude de données
rec$cc<-paste(rec$AN, rec$Parcelle, rec$Var, rec$Bloc, sep="_")
rec<-mutate(group_by(rec, cc), NbUniqpRec=length(unique(pRec_ig)),
            diffXNpRec=max(pRec_ig, na.rm=T)-min(pRec_ig, na.rm=T), pRecX=max(pRec_ig, na.rm=T))
rec<-subset(rec, NbUniqpRec>3 & diffXNpRec>15)

# Ajout des valeurs initiales et finales
rec %>% group_by(cc) %>% do ({
  # extract and modify the first row
  firstRow <- lastRow <- .[1,]
  firstRow[c("Date_Obs_pRec_JAP", "pRec_ig")] <- 0
  lastRow[c("Date_Obs_pRec_JAP", "pRec_ig")] <- c(280, 99999)
  # bind the first row with the sub data frame . represents a data frame with a unique subject_ID
  bind_rows(firstRow, ., lastRow)
})->rec
rec$pRec_ig<-ifelse(rec$pRec_ig==99999, rec$pRecX, rec$pRec_ig)

# Modelisation des 400 situations
ccr<-levels(as.factor(rec$cc))
lmr<-list()
i<-0
for (i in 1:length(levels(as.factor(rec$cc)))) {
  tryCatch({
    i<-i+1
    recs<-subset(rec, cc==ccr[i])
    m<-drm(pRec_ig~Date_Obs_pRec_JAP, cc, data=recs, fct=L.3(),
           lowerl=c(-Inf, 5, 50), upperl=c(0,100, 280),
           control = drmc(trace=F, maxIt=100000))
    lmr<-c(lmr, list(m))
    #return(lmr)
  }, error=function(e){
    # cat("ERROR :",conditionMessage(e), "\n")
    })
}

# Suppression des modeles errones
DeleteBadModel<- function(fit) {
  ifelse(length(fit$predres)<7, return(NA), return(fit))
}
lmr2<-lapply(lmr, DeleteBadModel)
lmr2<-lmr2[lapply(lmr2,length)>1]

# pdf("GCmodels.pdf")
# par(mfrow = c(6,3), mar=c(2,2,2,2))
# for (i in 1:length(lmr2)) {
#   fit<-lmr2[[i]]
#   plot(fit, main=colnames(fit$parmMat))
# }
# dev.off()

# # retrouver un model
# WhichModel<- function(fit) {
#   if (fit$dataList$curveid[1]=="2014_AB_NUREANGDAN_1") { break }
# }
# i=0
# lapply(lmr2, WhichModel)

# # Graph des modeles
# PlotModel<- function(fit) {
#     png(height=7, width=7, res=300, units="in",
#         filename=paste("./out/plotRec/", fit$dataList$curveid[1], ".png", sep=""))
#     plot(fit)
#     dev.off()
# }
# lapply(lmr2, PlotModel)

# Extraire les infos utiles des modeles
ExtrModelInfo <- function(fit) {
  data.frame(code=paste0(dimnames(fit$indexMat)[2]),
             EM5=ED(fit, 5)[1], EM50=ED(fit, 50)[1],
             I5.3=ED(fit, 90)[1]-ED(fit, 10)[1],
             Slope=summary(fit)$coef[1],
             I5.2=summary(fit)$coef[2],
             Tinflex=summary(fit)$coef[3])
}
resRe<-lapply(lmr2, ExtrModelInfo)
resRe=do.call(rbind, resRe)
resRe<-separate(resRe, code, into=c("AN", "Parcelle", "Var"), sep="_")
resRe$AN<-as.integer(resRe$AN)
resRe<-left_join(comb, resRe, by=c("AN", "Parcelle", "Var"))
dfadv<-resRe
resRe<-dplyr::summarize(group_by(resRe, AN, Zone, Parcelle, Var, Sp),
                        I5.2=mean(I5.2, na.rm=T),
                        I5.3=mean(I5.3, na.rm = T))
adv<-left_join(adv, resRe, by=c("AN", "Zone", "Parcelle", "Var", "Sp"))

# # Mise en graphique
# # Exemple avec trop peu de points
# lmr[[212]]$dataList$curveid
# newdata<-expand.grid(Date_Obs_pRec_JAP=c(0:300))
# pm<-predict(lmr[[212]], newdata=newdata, interval="confidence")
# newdata$p<-pm[,1]
# p1<-ggplot(subset(rec, cc=="2014_BA_INRAAL56"),
#            aes(x=Date_Obs_pRec_JAP, y=pRec_ig)) +
#     geom_point() + xlim(0,250)+ylim(0,100)+
#     geom_line(data=newdata, aes(x=Date_Obs_pRec_JAP, y=p))+
#     theme_bw(base_size = 20)+ylab("Recouvrement du sol (%)")+
#     xlab("Jours après plantation")+
#     ggtitle("Manque de données")
#
# # Exemple de non convergence du modèle
# p2<-ggplot(subset(reclass_date(), cc=="2012_AB_KINABAYO"), aes(x = End, y = Nc/Np)) +
#     geom_point() +xlim(0,150)+ylim(0,1)+
#     # geom_line(data=newdata, aes(x=Start, y=p))+
#     theme_bw(base_size = 20)+ylab("Taux d'émergence")+
#     xlab("Jours après plantation")+
#     ggtitle("Non convergence")+
#     theme(axis.text.y = element_blank(),
#           axis.title.y = element_blank())
#
# # Exemple avec suffisament de point
# lmr[[15]]$dataList$curveid
# newdata<-expand.grid(Start=c(0:150))
# pm<-predict(lmr[[15]], newdata=newdata, interval="confidence")
# newdata$p<-pm[,1]
# p3<-ggplot(subset(rec, cc=="2012_BA_KINABAYO"), aes(x = End, y = Nc/Np)) +
#     geom_point() +xlim(0,150)+ylim(0,1)+
#     geom_line(data=newdata, aes(x=Start, y=p))+
#     theme_bw(base_size = 20)+ylab("Taux d'émergence")+
#     xlab("Jours après plantation")+
#     ggtitle("Modèle correct")+
#     geom_segment(aes(y=.5, yend=.5, x=ED(lmr[[15]], 5)[1],
#                      xend=ED(lmr[[15]], 95)[1]), color="red", size=2,
#                  arrow = arrow(length = unit(0.5, "cm"), ends="both"))+
#     geom_text(aes(x=ED(lmr[[15]], 95)[1],
#                   y=.45, label=paste("I5.1 : ",
#                                      round(ED(lmr[[15]], 95)[1]-ED(lmr[[15]], 5)[1], 1),
#                                      " jours", sep="")), color="red", size=10)+
#     theme(axis.text.y = element_blank(),
#           axis.title.y = element_blank())
#
# library(gridExtra)
#
# png(height=8, width=14, res=300, units="in", type="cairo",family="Garamond",
#     filename="I5.2.png")
# grid.arrange(p1, p2, p3, ncol=3)
# dev.off()
