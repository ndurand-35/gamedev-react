import { Designer, Developer } from '@/data/interface';
import { MAX_STAT_POSSIBLE } from '@/data/utils';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// Enum pour les rôles
enum PersonType {
  DEV = 'Développeur',
  DESIGNER = 'Designer',
}
const pointToSpend = 15

// Nouvelle page de création de partie
const NewGamePage: React.FC = () => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [sex, setSex] = useState('M');
  const [personType, setPersonType] = useState<PersonType>(PersonType.DEV);
  const [pointsRemaining, setPointsRemaining] = useState(0);
  

  // Gestion des compétences du développeur
  const [developerSkills, setDeveloperSkills] = useState<Developer>({
    id: 1,
    sex: 'M',
    firstName: '',
    lastName: '',
    salary: 0,
    frontStat: 5,
    frontMaxStat: MAX_STAT_POSSIBLE,
    backStat: 5,
    backMaxStat: MAX_STAT_POSSIBLE,
    debugStat: 5,
    debugMaxStat: MAX_STAT_POSSIBLE,
  });

  // Gestion des compétences du designer
  const [designerSkills, setDesignerSkills] = useState<Designer>({
    id: 1,
    sex: 'M',
    firstName: '',
    lastName: '',
    salary: 0,
    creativityStat: 5,
    creativityMaxStat: MAX_STAT_POSSIBLE,
    visualDesignStat: 5,
    visualDesignMaxStat: MAX_STAT_POSSIBLE,
    animationStat: 5,
    animationMaxStat : MAX_STAT_POSSIBLE,
  });

  const navigate = useNavigate();

  // Gestion du slider pour les développeurs
  const handleDeveloperSkillChange = (skill: keyof Developer, value: number) => {
    // Calculate the points spent considering the new skill value
    const newSkillValue = value;
    const totalPointsSpent =
      developerSkills.frontStat +
      developerSkills.backStat +
      developerSkills.debugStat -
      (developerSkills[skill] as number) + // Subtract the old skill value
      newSkillValue;                        // Add the new skill value

    const pointsToSpend = pointToSpend - totalPointsSpent;

    if (pointsToSpend >= 0) {
      setDeveloperSkills((prevSkills) => ({
        ...prevSkills,
        [skill]: newSkillValue,
      }));
      setPointsRemaining(pointToSpend - totalPointsSpent); // Update the remaining points correctly
    }
  };




  // Gestion du slider pour les designers
  const handleDesignerSkillChange = (skill: keyof Designer, value: number) => {
    // Calculer les points dépensés en prenant en compte la nouvelle valeur du skill
    const newSkillValue = value;
    const totalPointsSpent =
      designerSkills.creativityStat +
      designerSkills.visualDesignStat -
      (designerSkills[skill] as number) +  // Soustraire l'ancienne valeur du skill
      newSkillValue;            // Ajouter la nouvelle valeur du skill

    const pointsToSpend = pointToSpend - totalPointsSpent;

    if (pointsToSpend >= 0) {
      setDesignerSkills((prevSkills) => ({
        ...prevSkills,
        [skill]: newSkillValue,
      }));
      setPointsRemaining(pointToSpend - totalPointsSpent); // Mettre à jour correctement les points restants
    }
  };


  // Fonction pour gérer la soumission du formulaire
  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    // Logique de création du personnage et soumission des données
    if (personType === PersonType.DEV) {
      console.log({
        firstName,
        lastName,
        sex,
        personType,
        skills: developerSkills,
      });
    } else {
      console.log({
        firstName,
        lastName,
        sex,
        personType,
        skills: designerSkills,
      });
    }

    navigate('/game'); // Redirige vers la page de jeu
  };

  return (
    <div
      className="min-h-screen bg-cover bg-center flex flex-col justify-center items-center"
      style={{ backgroundImage: 'url(/menu-bg.jpg)' }} // Image de fond fournie
    >
      <div className="bg-white bg-opacity-90 p-8 rounded-lg shadow-lg max-w-4xl w-full">
        <h1 className="text-3xl font-bold mb-6 text-center text-gray-800">Nouvelle Partie</h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-8">
            <div>
              {/* Prénom et Nom en une seule ligne */}

              {/* Prénom */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Prénom</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered w-full"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
              </div>

              {/* Nom */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Nom</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered w-full"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                />

              </div>

              {/* Sexe et Rôle en une seule ligne */}

              {/* Sexe */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Sexe</span>
                </label>
                <select className="select select-bordered w-full" value={sex} onChange={(e) => setSex(e.target.value)}>
                  <option value="M">Masculin</option>
                  <option value="F">Féminin</option>
                  <option value="O">Autre</option>
                </select>
              </div>

              {/* Rôle */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Rôle</span>
                </label>
                <select
                  className="select select-bordered w-full"
                  value={personType}
                  onChange={(e) => {
                    setPersonType(e.target.value as PersonType);
                    setPointsRemaining(0); // Réinitialiser les points à dépenser
                  }}
                >
                  <option value={PersonType.DEV}>Développeur</option>
                  <option value={PersonType.DESIGNER}>Designer</option>
                </select>
              </div>

            </div>

            {/* Panneau de compétences */}
            <div className="form-control mt-6">
              <h2 className="text-xl font-semibold mb-4">Dépenser des points de compétence</h2>
              <p className="mb-2">Points restants : {pointsRemaining}</p>


              {personType === PersonType.DEV && (
                <>
                  {/* Front-end */}
                  <div>
                    <div className='flex flex-row justify-between'>
                      <span className="label-text">Front-end</span>
                      <span>Niveau : {developerSkills.frontStat}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={MAX_STAT_POSSIBLE}
                      value={developerSkills.frontStat}
                      onChange={(e) => handleDeveloperSkillChange('frontStat', Number(e.target.value))}
                      className="range range-sm"
                    />

                  </div>

                  {/* Back-end */}
                  <div>
                    <div className='flex flex-row justify-between'>
                      <span className="label-text">Back-end</span>
                      <span>Niveau : {developerSkills.backStat}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={MAX_STAT_POSSIBLE}
                      value={developerSkills.backStat}
                      onChange={(e) => handleDeveloperSkillChange('backStat', Number(e.target.value))}
                      className="range range-sm"
                    />

                  </div>

                  {/* Debug */}
                  <div>
                    <div className='flex flex-row justify-between'>
                      <span className="label-text">Debug</span>
                      <span>Niveau : {developerSkills.debugStat}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={MAX_STAT_POSSIBLE}
                      value={developerSkills.debugStat}
                      onChange={(e) => handleDeveloperSkillChange('debugStat', Number(e.target.value))}
                      className="range range-sm"
                    />

                  </div>
                </>
              )}

              {personType === PersonType.DESIGNER && (
                <>
                  {/* Créativité */}
                  <div>
                    <div className='flex flex-row justify-between'>
                      <span className="label-text">Créativité</span>
                      <span >Niveau : {designerSkills.creativityStat}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={MAX_STAT_POSSIBLE}
                      value={designerSkills.creativityStat}
                      onChange={(e) => handleDesignerSkillChange('creativityStat', Number(e.target.value))}
                      className="range range-sm"
                    />

                  </div>

                  {/* Design Visuel */}
                  <div>
                    <div className='flex flex-row justify-between'>
                      <span className="label-text">Design Visuel</span>
                      <span >Niveau : {designerSkills.visualDesignStat}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={MAX_STAT_POSSIBLE}
                      value={designerSkills.visualDesignStat}
                      onChange={(e) => handleDesignerSkillChange('visualDesignStat', Number(e.target.value))}
                      className="range range-sm"
                    />

                  </div>

                  <div>
                    <div className='flex flex-row justify-between'>
                      <span className="label-text">Animation</span>
                      <span >Niveau : {designerSkills.animationStat}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={MAX_STAT_POSSIBLE}
                      value={designerSkills.animationStat}
                      onChange={(e) => handleDesignerSkillChange('animationStat', Number(e.target.value))}
                      className="range range-sm"
                    />

                  </div>
                </>
              )}
            </div>
          </div>

          {/* Bouton de soumission */}
          <button className="btn btn-primary mt-6 w-full">Commencer la Partie</button>
        </form>
      </div>
    </div>
  );
};

export default NewGamePage;
