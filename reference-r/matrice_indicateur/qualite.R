#source("/opt/shiny-server/samples/sample-apps/Projet_Rita/R/model.R")

qua<-ldf[["dqua"]]
qua<-left_join(comb, qua, by=c("Var", "Sp"))
qua$I4.1<-ifelse(qua$Couleur=="blanche", chC$note[1],
                 ifelse(qua$Couleur=="creme", chC$note[2],
                        ifelse(qua$Couleur=="jaunatre", chC$note[3],
                               ifelse(qua$Couleur=="orange", chC$note[4], chC$note[5]))))
qua$I4.2<-ifelse(qua$Oxydation=="faible", 3,
                 ifelse(qua$Oxydation=="moyenne", 2,
                        ifelse(qua$Oxydation=="moyenne forte", 1, 0)))
qua$I3.2<-ifelse(qua$Conservation==">1 mois", 1,0)
qua<-dplyr::select(qua, AN, Zone, Parcelle, Var, Sp, I3.2, I4.1, I4.2)

# # Mise en graphique 
# png(height=8, width=12, res=300, units="in", type="cairo",family="Garamond",
#     filename="I4.2.png")
# ggplot(subset(qua, !is.na(Sp)), aes(Var, 3-I4.2))+
#     geom_bar(stat="identity")+
#     theme_bw(base_size = 20)+
#     facet_grid(Sp~., drop=T, scale="free_y", space="free_y")+
#     coord_flip()+
#     theme(axis.title.y = element_blank())+
#     ylab("I4.2 : Brunissement (note qualitative de 0 à 4)")
# dev.off()