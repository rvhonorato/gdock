#!/usr/bin/env tcsh
#PBS -N gdock
#PBS -q medium
#PBS -l nodes=1:ppn=48
#PBS -S /bin/tcsh

cd /home/rodrigo/projects/gdock-run
source /home/rodrigo/software/miniconda3/etc/profile.d/conda.csh
conda activate gadock
python /home/rodrigo/repos/gdock/gdock.py run.toml > gdock.out