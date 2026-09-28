# source("/opt/shiny-server/samples/sample-apps/Projet_Rita/R/model.R")

san<-ldf[["dsan"]]
# san<-subset(san, Zone=="GT" & Sp=="Dcr")
# comb<-subset(comb, Zone=="GT" & Sp=="Dr")
temp<-anti_join(comb, san, by=c("AN", "Parcelle", "Var", "Sp", "Zone"))
san<-full_join(temp, san, by=c("AN", "Parcelle", "Var", "Sp", "Zone"))
san$IDM<-ifelse(is.na(san$IDM), 0, san$IDM)
sans<-dplyr::summarize(group_by(san, AN, Parcelle, Var, Cause_Mal),
                       IDM=max(IDM),
                       JAP_san=max(Date_Obs_Mal_JAP))
sans<-left_join(sans, dplyr::select(dvar, -Var), by=c("Var"="Code"))
sans$Cause_Mal<-ifelse(sans$Sp=="Da",
                       ifelse(sans$Cause_Mal=="Anthracnose", "I2.1", "I2.2"),
                       ifelse(sans$Cause_Mal=="Cur", "I2.1", "I2.2"))
sans<-spread(sans, Cause_Mal, IDM)
sans<-dplyr::select(sans, AN, Parcelle, Var, Sp, I2.1, I2.2)
sans<-left_join(comb, sans, by=c("AN", "Parcelle", "Var", "Sp"))
sans[is.na(sans)] <- 0
sans<-dplyr::summarize(group_by(sans, AN, Zone, Parcelle, Var, Sp),
                       I2.1=max(I2.1), I2.2=max(I2.2))
# # Mise en graphique
# png(height=8, width=12, res=300, units="in", type="cairo",family="Garamond",
#     filename="I2.1.png")
# ggplot(sans, aes(Var, I2.1))+
#     geom_point(aes(group=factor(AN), group=Parcelle))+
#     theme_bw(base_size = 22)+
#     theme(legend.position="none",
#           axis.text.x = element_text(angle = 45, vjust = 1, hjust=1),
#           axis.title.x = element_blank())+
#     ylab("I2.1 : Sensibilité à la maladie principale \n(note visuelle)")
# dev.off()
# 
# png(height=8, width=12, res=300, units="in", type="cairo",family="Garamond",
#     filename="I2.2.png")
# ggplot(sans, aes(Var, I2.2))+
#     geom_point(aes(group=factor(AN), group=Parcelle))+
#     theme_bw(base_size = 22)+
#     theme(legend.position="none",
#           axis.text.x = element_text(angle = 45, vjust = 1, hjust=1),
#           axis.title.x = element_blank())+
#     ylab("I2.2 : Sensibilité aux autres maladies\n(note visuelle)")+
#     ylim(0,4)
# dev.off()
