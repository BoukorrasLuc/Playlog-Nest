# Projet Playlog 🇫🇷

Le but principal de ce projet est de déterminer la valeur de votre collection, en se concentrant principalement sur l'univers du jeu vidéo. Il comprend plus de 30 000 articles liés au monde du jeu vidéo, y compris des consoles, des accessoires et des jeux vidéo. À l'avenir, nous prévoyons de nous étendre au domaine des cartes à collectionner, comme Pokemon, Magic, et d'autres.

Le répertoire dataClusterSeed est un tri des données collectées à partir de PriceCharting. Vous pouvez visiter leur site web pour plus d'informations : https://www.pricecharting.com/


Actuellement, l'accent est mis sur les jeux vidéo, les consoles et les accessoires.

Lors de l'exécution de la commande `npm run seedP`, tous les prix de PriceCharting ne sont pas ajoutés car ils sont en dollars américains.

C'est pourquoi un travail cron a été mis en place pour récupérer les ventes réussies sur eBay. ⚠️ Veuillez noter que le travail cron actuel récupère toutes les 10 secondes par article pour obtenir beaucoup de résultats pour l'amélioration. Cela pourrait potentiellement conduire à une grande quantité de données étant traitées et peut saturer la mémoire de votre ordinateur. Assurez-vous que votre système dispose de ressources suffisantes pour gérer cette charge. ⚠️

Initialement, le service de scraping ne traitait que des jeux vidéo complets en boîte...

Cette première version est fonctionnelle. Il y a quelques ajustements mineurs à faire pour améliorer le scraping eBay et la mise à jour des prix et des dates de vente sur eBay.

Le projet est nommé Playlog, une combinaison de 'player' et 'log' de console.log.

😊 Toutes les idées, l'aide, ou les partages pour le projet sont les bienvenus. 😊

## Commandes pour lancer le projet backend

Pour construire le projet, utilisez la commande suivante :

1.1 Remplacez le fichier env.example par votre fichier .env

1.2 Installez les packages nécessaires avec la commande

```bash
npm install
```

1.3 Lancez les seeds pour peupler votre base de données MySQL avec la commande

```bash
npm run seedP
```

1.4 Exécutez la commande suivante pour démarrer le projet en mode watch

```bash
npm run start:dev
```

## Schéma de la base de données
Pour une meilleure compréhension du projet, voici le schéma de la base de données :

![Schéma de la base de données](/img/Database.png)

## Résultat du scraping actuellement
Jeux vidéo complets : 166/168 (95%)
Jeux vidéo manuels : (100%)


## Prochaine fonctionnalité

✅ 1.1.1: Améliorer le processus de scraping d'eBay pour obtenir de meilleurs résultats pour les jeux vidéo complets.

🚧 1.1.1.1: Améliorer le processus de scraping d'eBay pour obtenir de meilleurs résultats pour les manuels de jeux vidéo uniquement.

🚧 1.1.1.2: Ajouter le processus de scraping d'eBay pour obtenir de meilleurs résultats pour la boîte de jeux vidéo uniquement.

🚧 1.1.1.3: Ajouter le processus de scraping d'eBay pour obtenir de meilleurs résultats pour les jeux vidéo neufs uniquement.

🚧 1.1.1.4: Ajouter le processus de scraping d'eBay pour obtenir de meilleurs résultats pour les jeux vidéo neufs uniquement.

🚧 1.1.1.5: Ajouter le processus de scraping d'eBay pour obtenir de meilleurs résultats pour les jeux vidéo grader uniquement.

🚧 1.1.1.5: Ajouter le processus de scraping d'eBay pour obtenir de meilleurs résultats pour les jeux vidéo en loose uniquement.

1.1.2: Améliorer le processus de scraping d'eBay pour obtenir de meilleurs résultats pour les consoles.

1.1.3: Améliorer le processus de scraping d'eBay pour obtenir de meilleurs résultats pour les accessoires.


Version 0.0.1