# source("/opt/shiny-server/samples/sample-apps/Projet_Rita/R/model.R")

# Curseur taille min et max de tubercule
# !!!!!!!!!!!!!!
Tx<-4000
Tn<-200
# !!!!!!!!!!!!!!

# Loading Data
# source('~/R/R projects/RITA2_VaPaDonF/R/VarName_suite.R')
rdt1<-ldf[["drdt1"]]
rdt2<-ldf[["drdt2"]]
pla<-ldf[["dpla"]]
em<-ldf[["deme"]]

# Calcul du nombre de plants plantés
plas<-dplyr::summarize(group_by(pla, AN, Parcelle, Var), Nb_Pl_Pl=sum(NB_P_Parc))

# Calcul du nombre de plantes recoltees à partir de rec_plant
rdt1$Nb_PL_Tot<-rowSums(rdt1[,c("NB_PL_1T", "NB_PL_2T", "NB_PL_3T", "NB_PL_4T",
                                "NB_PL_5T", "NB_PL_6T")], na.rm=T)
rdt1s<-dplyr::summarise(group_by(rdt1, AN, Parcelle, Var),
                        Nb_PL_Tot=ifelse(sum(Nb_PL_Tot)==0, sum(NB_Rec_Parc),
                                         sum(Nb_PL_Tot)),
                        NB_Rec_Parc=sum(NB_Rec_Parc))

# Calcul du poids commercial
rdt2$Defaut1<-as.character(rdt2$Defaut1)
rdt2$Defaut2<-as.character(rdt2$Defaut2)
rdt2$Defaut3<-as.character(rdt2$Defaut3)
rdt2$PoidsCom<-ifelse(paste0(rdt2$Defaut1, rdt2$Defaut2, rdt2$Defaut3)!="" |
                        rdt2$Poids<Tn | rdt2$Poids>Tx, 0, rdt2$Poids)

# Calcul du poids cumule (commercial ou non) et du nombre de tubercules recoltes
rdt2s<-dplyr::summarise(group_by(rdt2, AN, Parcelle, Var),
                        Nb_Tub_Rec=n(),
                        PoidsTot=sum(Poids, na.rm=T),
                        I1.3=sd(Poids)/mean(Poids)*100,
                        PoidsTotCom=sum(PoidsCom, na.rm=T))

# Calcul du nb de plants emerges (suivi indi en pr et suivi hebdo en pp)
ems_pp<-dplyr::summarise(group_by(subset(em, is.na(Plante)), AN, Parcelle, Var, Date_Levee),
                         NB_Pl_EM=sum(NB_Lev_Billon))
ems_pp<-dplyr::summarise(group_by(ems_pp, AN, Parcelle, Var), NB_Pl_EM=max(NB_Pl_EM))
ems_pr<-subset(em, !is.na(Plante) & !is.na(Date_Levee))
ems_pr<-dplyr::summarise(group_by(ems_pr, AN, Parcelle, Var), NB_Pl_EM=n())

# Fusion des df
ems<-rbind(ems_pr, ems_pp)
rdts<-left_join(rdt2s, rdt1s, by=c("AN", "Parcelle", "Var"))
rdts<-left_join(ems, rdts, by=c("AN", "Parcelle", "Var"))
rdts<-dplyr::mutate(rdts,  Nb_Pl_RecF=ifelse(is.na(pmin(Nb_PL_Tot, NB_Rec_Parc)), 
                                             NB_Pl_EM, pmin(Nb_PL_Tot, NB_Rec_Parc)))
rdt<-left_join(rdts, dfs, by=c("AN", "Parcelle"))
write_csv(rdt, "./Fiches_yield.csv")
pla<-full_join(rdts, plas, by=c("AN", "Parcelle", "Var"))

# Calcul des rendements
rdt$I1.1<-rdt$PoidsTot/rdt$Nb_Pl_RecF*rdt$Densite/100
rdt$I1.2<-rdt$PoidsTotCom/rdt$Nb_Pl_RecF*rdt$Densite/100
rdt<-dplyr::mutate(group_by(rdt, Var), 
                   I1.4=sd(I1.1, na.rm=T)/mean(I1.1, na.rm=T)*100)
rdt<-dplyr::select(rdt, AN, Parcelle, Var, I1.1, I1.2, I1.3, I1.4)
rdt<-left_join(comb, rdt, by=c("AN", "Parcelle", "Var"))

write_csv(rdt, "./yield.csv")
# # Exemple graphique
# png(height=10, width=14, res=300, units="in", type="cairo",family="Garamond",
#     filename="I1.1.png")
# ggplot(subset(rdt, AN %in% c(2012:2014) & Parcelle!="Duclos" & Parcelle!="SF" &
#               Parcelle!="GB"),  aes(Var, I1.1))+
#     geom_bar(stat="identity")+
#     facet_grid(Parcelle~AN, drop=T, scale="free_x")+
#     theme_bw(base_size = 16)+
#     theme(axis.text.x = element_text(angle = 45, vjust = 1, hjust=1),
#           axis.title.x = element_blank())+
#     ylab("I1.1 : Rendement (t/ha)")
# dev.off()
# 
# png(height=10, width=14, res=300, units="in", type="cairo",family="Garamond",
#     filename="I1.2.png")
# ggplot(subset(rdt, AN %in% c(2012:2014) & Parcelle!="Duclos" & Parcelle!="SF" &
#                   Parcelle!="GB"),  aes(Var, I1.2))+
#     geom_bar(stat="identity")+
#     facet_grid(Parcelle~AN, drop=T, scale="free_x")+
#     theme_bw(base_size = 16)+
#     theme(axis.text.x = element_text(angle = 45, vjust = 1, hjust=1),
#           axis.title.x = element_blank())+
#     ylab("I1.2 : Rendement commerciale (t/ha)")
# dev.off()
# 
# png(height=10, width=14, res=300, units="in", type="cairo",family="Garamond",
#     filename="I1.3.png")
# ggplot(subset(drdt2, Parcelle %in% c("AB", "BA", "Duclos") &
#                   AN %in% c(2012, 2013)),  aes(Var, Poids))+
#     geom_boxplot()+
#     facet_grid(AN~Parcelle, drop=T, scale="free_x", space="free_x")+
#     theme_bw(base_size = 22)+
#     theme(axis.text.x = element_text(angle = 45, vjust = 1, hjust=1),
#           axis.title.x = element_blank())+
#     ylab("I1.3 : Variabilité du poids des tubercules (g) \n au sein de chaque situations")
# dev.off()
# 
# png(height=8, width=14, res=300, units="in", type="cairo",family="Garamond",
#     filename="I1.4.png")
# ggplot(subset(rdt, !is.na(Sp) & I1.1<200),  aes(Var, I1.1))+
#     geom_boxplot()+
#     facet_grid(.~Sp, drop=T, scale="free_x", space="free_x")+
#     theme_bw(base_size = 22)+
#     theme(axis.text.x = element_text(angle = 45, vjust = 1, hjust=1),
#           axis.title.x = element_blank())+
#     ylab("I1.4 : Variabilité du poids des tubercules (g) \nentre situations")
# dev.off()
# 
