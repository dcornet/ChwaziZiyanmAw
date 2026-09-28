# Load data and indicators

# source("/opt/shiny-server/samples/sample-apps/Projet_Rita/R/model.R",local = TRUE)
source("/opt/shiny-server/samples/sample-apps/Projet_Rita/R/matrice_indicateur/Production.R",local = TRUE)
source("/opt/shiny-server/samples/sample-apps/Projet_Rita/R/matrice_indicateur/Resistance.R",local = TRUE)
source("/opt/shiny-server/samples/sample-apps/Projet_Rita/R/matrice_indicateur/Conservation.R",local = TRUE)
source("/opt/shiny-server/samples/sample-apps/Projet_Rita/R/matrice_indicateur/qualite.R",local = TRUE)
source("/opt/shiny-server/samples/sample-apps/Projet_Rita/R/matrice_indicateur/adventice.R",local = TRUE)


#Merge constraints df
ind<-left_join(rdt, sans, by=c("AN", "Zone", "Parcelle", "Sp", "Var"))
ind<-left_join(ind, cons, by=c("AN", "Zone", "Parcelle", "Sp", "Var"))
ind<-left_join(ind, qua, by=c("AN", "Zone", "Parcelle", "Sp", "Var")) 
ind<-left_join(ind, adv, by=c("AN", "Zone", "Parcelle", "Sp", "Var")) 

MatSubIndAbs<-ind

# Scaling Subindicators between 0-1 for each situation
# scaling by situation in order not to favor variety not evaluated in poor situation (e.g. SF)
# Different scaling based on variable type (open, bounded...)
ScalingFct<-function(x) { ifelse(diff(range(x, na.rm=T))==0, .5,
                                 (x-min(x, na.rm=T))/diff(range(x, na.rm=T))) }
# ind<-mutate_at(group_by(ind, AN, Zone, Parcelle, Sp), vars(contains("I")),
#                ScalingFct)
ind<-dplyr::mutate(group_by(ind, AN, Zone, Parcelle, Sp),
                   ran=diff(range(I1.1, na.rm=T)),
                   I1.1=ifelse(ran==0, .5, (I1.1-min(I1.1, na.rm=T))/ran),
                   ran=diff(range(I1.2, na.rm=T)),
                   I1.2=ifelse(ran==0, .5, (I1.2-min(I1.2, na.rm=T))/ran),
                   ran=diff(range(I1.3, na.rm=T)),
                   I1.3=ifelse(ran==0, .5, (I1.3-min(I1.3, na.rm=T))/ran),
                   ran=diff(range(I1.4, na.rm=T)),
                   I1.4=ifelse(ran==0, .5, (I1.4-min(I1.4, na.rm=T))/ran),
                   I2.1=I2.1/4,   # entre 0 et 4 de résistance à la maladie principale
                   I2.2=I2.2/4,   # entre 0 et 4 de résistance aux autres maladies
                   I3.1=I3.1/100, # entre 0 et 100 d'émergence
                   # I3.2=ScalingFct(I1.1), ok deja entre 0 et 1
                   I4.1=(I4.1-1)/4, # entre 1 et 5 (likert scale)
                   I4.2=I4.2/3, # entre 0 et 3 de brunissement
                   ran=diff(range(I5.1, na.rm=T)),
                   I5.1=ifelse(ran==0, .5, (I5.1-min(I5.1, na.rm=T))/ran),
                   ran=diff(range(I5.2, na.rm=T)),
                   I5.2=ifelse(ran==0, .5, (I5.2-min(I5.2, na.rm=T))/ran),
                   ran=diff(range(I5.3, na.rm=T)),
                   I5.3=ifelse(ran==0, .5, (I5.3-min(I5.3, na.rm=T))/ran))
ind<-dplyr::select(ind, -ran)
            
# Polarization of subindicators
indg<-gather(ind, SubInd, Value, starts_with("I"))
NegSubInd<-c("I1.3", "I1.4", "I2.1", "I2.2", "I5.1", "I5.3")
indg$Value<-ifelse(indg$SubInd %in% NegSubInd, 1-indg$Value, indg$Value)

# Estimating Indicator scores (mean of subindicators)
indg<-separate(indg, col=SubInd, into=c("Ind", "SubIn"), sep="\\.")
indgs<-dplyr::summarize(group_by(indg, AN, Zone, Parcelle, Sp, Var, Ind),
                        IndScores=mean(Value, na.rm=T))

# Multiply each indicator by its weight (coming from farmers prioritization)
#prior<-data.frame(Ind=c("I1", "I2", "I3", "I4", "I5"), Prio=c(1,1,1,1,1))
prior<-data.frame(Ind=c("I1", "I2", "I3", "I4", "I5"), Prio=as.integer(c(chQ$note, chC$note)))

indgs<-left_join(indgs, prior, by="Ind")
indgs$IndScoresPrior<-indgs$IndScores*indgs$Prio

# Matrix for radarchart
mind<-dplyr::summarize(group_by(indgs, Var, Ind),
                       IndScore=mean(IndScores, na.rm=T)*10)

# Estimating situation score (sum of weighted indicators for each situation)
# !!!!!!!! mean or max (eg resistance) ? !!!!!!!!!
indgs<-dplyr::summarize(group_by(indgs, AN, Zone, Parcelle, Sp, Var),
                        SitScore=sum(IndScoresPrior))

# Estimating Varietal score (mean between situations)
indgs<-dplyr::summarize(group_by(indgs, Sp, Var),
                        VarScore=mean(SitScore, na.rm=T),
                        N=sum(!is.na(SitScore)),
                        SD_VarScore=sd(SitScore, na.rm=T))

# Normalize varietal score
indgs$VarScore<-(indgs$VarScore-min(indgs$VarScore, na.rm=T))/diff(range(indgs$VarScore, na.rm=T))*10

# Sort data by score and select usefull variables
dffinal<-dplyr::select(ungroup(indgs), Var,  VarScore)
colnames(dffinal)<-c("Variété", "Score")
dffinal<-dffinal[with(dffinal, order(Score)), ]


### Results --------------------------------------------------------------------
#### Plot the radar chart -----------------------
VarTrad<-c("ANBABON", "GROSSECAILLE", "KABUSAH", "KINABAYO", "PAKALA", "GOANA")
dffinal$VarType<-ifelse(dffinal$Variété %in% VarTrad, "Variété témoin",
                        "Variété améliorée")
minds<-spread(mind, Ind, IndScore)
colnames(minds)<-c("Variété", "Production", "Maladie", "Conservation",
                   "Qualité", "Mauvaises herbes")
minds<-as.data.frame(minds)


