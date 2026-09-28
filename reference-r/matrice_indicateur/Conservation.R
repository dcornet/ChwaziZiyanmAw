# source("/opt/shiny-server/samples/sample-apps/Projet_Rita/R/model.R")
# source('/srv/shiny-server/sample-apps/Projet_Rita/R/matrice_indicateur/Production.R')





pla$I3.1<-pla$Nb_Pl_RecF/pmax(pla$NB_Pl_EM, pla$Nb_Pl_RecF)*100
cons<-left_join(comb, dplyr::select(pla, AN:Var, I3.1), 
                by=c("AN", "Parcelle", "Var"))

# NE PAS MODIFIER
#cons = pla

# # Mise en graphique
# png(height=8, width=12, res=300, units="in", type="cairo",family="Garamond",
#     filename="I3.1.png")
# ggplot(subset(pla, !is.na(Sp)), aes(Var, I3.1))+
#     geom_boxplot()+
#     theme_bw(base_size = 20)+
#     facet_grid(Sp~., drop=T, scale="free_y", space="free_y")+
#     coord_flip()+
#     theme(axis.title.y = element_blank())+
#     ylab("I3.1 : Taux d'émergence de l'année suivante (%)")
# dev.off()

