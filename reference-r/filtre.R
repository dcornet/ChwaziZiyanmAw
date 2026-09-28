source("/opt/shiny-server/samples/sample-apps/Projet_Rita/R/model.R")

choose_zone_espece=function(bdd, list_esp, list_zn) {
  if (isTRUE("Zone" %in% colnames(bdd))) {
    filtre = subset(bdd, Sp %in% list_esp & Zone %in% list_zn)
  } else { filtre=subset(bdd, Sp %in% list_esp) }
}

filtre_all1=function(bdd, list_esp, list_zone) {
  filtre_bdd=bdd
  f=lapply(filtre_bdd, choose_zone_espece, list_esp = list_esp, list_zn = list_zone) 
  return(f)
}
