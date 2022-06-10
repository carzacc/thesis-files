These steps won't include much commentary on the reasoning for the choices as that's all in my thesis.

# Creating a virtualized Kubernetes cluster using Fedora CoreOS VMs

We are going to create a three-node cluster with one control plane and two workers.

The following steps can be replicated on a workstation or server with the following:

* a (ideally RedHat-based) Linux distribution with `podman`, `libvirt` and `virt-install` running on at least 16G of RAM, 6 cores and about 30G of free space to avoid issues.
* an extracted qcow2 image of Fedora CoreOS, which can be downloaded as an XZ archive from [the Fedora CoreOS official website](https://getfedora.org/en/coreos/download?tab=metal_virtualized&stream=stable&arch=x86_64).

The steps have been tested on x86 systems with Fedora Workstation 36 and Red Hat Enterprise Linux 9 as the host operating system.

## Create an Ignition script

To inizialize the VM, a JSON Ignition script is used, which can be derived from the [`fcos.bu`](fcos.bu) YAML file using Butane. Before doing that, generate an SSH key pair using `ssh-keygen` or locate an existing one you'd like to use for the VMs we're about to create and replace `<INCOLLARE QUI CHIAVE PUBBLICA>` in the aforementioned [`fcos.bu`](fcos.bu) file with the public key content, all on one line.

Use the `butane` OCI container to generate the Ignition file by running

~~~
podman run --interactive --rm \
quay.io/coreos/butane:release \
--pretty --strict < fcos.bu > fcos.ign
~~~

Take note of the path of the generated `fcos.ign` file, and set it as the value assigned to the `IGN_CONFIG` variable in [`start_fcos.sh`](start_fcos.sh). In that file, change the `IMAGE` variable to the path to the downloaded QCOW2 Fedora CoreOS image.

In three different terminals or tmux panes or windows run `./start_fcos.sh 1`, `./start_fcos.sh 2` and `./start_fcos.sh 3` to create three nodes called `node1`, `node2` and `node3`. The Virtual Machine Manager (`virt-manager`) GUI tool can be used to manage these three VMs after the initial setup.

Look for lines like

~~~
Fedora CoreOS 36.20220505.3.2
Kernel 5.17.5-300.fc36.x86_64 on an x86_64 (ttyS0)
SSH host key: SHA256:70h+0L1lAfXChOpmBH1odArSLRCMJY2v9sOM45XThyM (ECDSA)
SSH host key: SHA256:M3Tcq1tebp+uFKAXqo6kD+PWIzzz03ndwreIEhFR5IQ (ED25519)
SSH host key: SHA256:EnywjztiwTBK9nLy47wj/gaus3wgAflI11j2ckXE0QM (RSA)
enp1s0: 192.168.122.146 fe80::cc38:c8c:7c38:c0fc
~~~

in the three terminals and add the IP addresses to `/etc/hosts` on the host system like in this example:

~~~
192.168.122.146 node1
192.168.122.96 node2
192.168.122.87 node3
~~~
to then be able to more easily access the nodes from the host PC.

Log in via SSH as the core user on the three nodes (for example in three panes in another `tmux` window) using `ssh core@node1`, `ssh core@node2` and `ssh core@node3`.

Set the hostname on each node to `node1`, `node2` and `node3` by creating the `/etc/hostname` file on each as root, for example like this in the first node:

~~~
sudo -i # become root
echo "node1" > /etc/hostname # set the hostname
~~~

On the first node (which will be the cluster's control plane) install CRI-O and the required tools to create and manage the cluster with:

~~~
sudo rpm-ostree install kubelet kubeadm kubectl cri-o
~~~

On the other nodes, only the CRI-O runtime, kubelet and kubeadm are needed, and they can be installed with:

~~~
sudo rpm-ostree install kubelet kubeadm cri-o
~~~

reboot using `sudo systemctl reboot` to apply the hostname change and the updates (Fedora CoreOS uses OSTree which only updates system files on reboot to ensure atomic updates).

After the reboot, log in to all the nodes again and start CRI-O and kubelet using
~~~
sudo systemctl enable --now crio kubelet
~~~

Create a `clusterconfig.yml` on the control plane just like [the one in this directory of the repository](clusterconfig.yml) (using `vi` for example) and then run:

~~~
kubeadm init ––config clusterconfig.yml
~~~

to initialize the cluster.


After it's done, configure `kubectl` on the control plane by running the suggested commands:

~~~
mkdir -p $HOME/.kube
sudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config
sudo chown $(id -u):$(id -g) $HOME/.kube/config
~~~

The `~/.kube/config` file can be copied to the host system as well to be able to run `kubectl` commands on the host directly instead of logging in to the control plane via SSH.

Set up Pod networking with `kube-router` by running:

~~~
kubectl apply -f \
https://raw.githubusercontent.com/cloudnativelabs/kube-router/master/daemonset/kubeadm-kuberouter.yaml
~~~

Add the other nodes as workers to the cluster by running (as root, therefore with `sudo`) the `kubeadm join` command shown at the end of the `kubeadm init` output. If it was lost, run:

~~~
kubeadm token create –-print-join-command
~~~

to get a new join command.

If all was done correctly, the cluster should be ready for action. Confirm this by running `kubectl get nodes` and verifying that all three nodes are shown as *Ready*.

# Deploying morra-flask on a Kubernetes cluster

## Deploying the MySQL InnoDBCluster with the official Oracle operator


### Initial setup

Install the CRDs for the InnoDBCluster with:

~~~
kubectl apply -f \
https://raw.githubusercontent.com/mysql/mysql-operator/trunk/deploy/deploy-crds.yaml
~~~

and then the operator with

~~~
kubectl apply -f \
https://raw.githubusercontent.com/mysql/mysql-operator/trunk/deploy/deploy-operator.yaml
~~~

Create a secret with DB access credentials with:

~~~
kubectl create secret generic credenziali-db-morra \
--from-literal=rootUser=root \
--from-literal=rootPassword=rootpassword
~~~

### Provisioning volumes

Let's create volumes to store the MySQL DB data. We are going to deploy two replicas so we need two volumes. We are going to use the `local` volume type for simplicity.

On `node2` and `node3`, create a `db-data-dir` directory in the `core` user's home directory with

~~~
mkdir db-data-dir
~~~

Then, apply to the cluster the config file [mysql-volumes.yml](mysql-volumes.yml) in this directory to add the two directories as PVs in the cluster.

### Creating the InnoDBCluster

Apply the [mysql-cluster.yml](mysql-cluster.yml) file in this directory to create and `InnoDBCluster` called `cluster-db-morra`



Wait until all the instances have been created and are all running. You can check this with `kubectl get pods` and making sure you have the following state:

~~~
NAME                                       READY   STATUS    RESTARTS   AGE
cluster-db-morra-0                         2/2     Running   0          15m
cluster-db-morra-1                         2/2     Running   0          15m
cluster-db-morra-router-7b8b54cb88-hrb8c   1/1     Running   0          13m
~~~


### Initializing the database

Let's use a Pod to initialize the database, also giving us an opportunity to make sure Pod networking and DNS resolution is working correctly. We can get a MySQL shell (after a few seconds of waiting to pull the image) with:

~~~
kubectl run --rm -it initdb --image=mysql -- \
mysql -uroot -prootpassword -hcluster-db-morra
~~~

and create a database with `CREATE DATABASE morra;`.

## Deploying a replicated Redis cluster with Sentinel and the Spotahome operator

Install the Spotahome Redis operator with

~~~
kubectl apply -f\
https://raw.githubusercontent.com/spotahome/redis-operator/master/manifests/databases.spotahome.com_redisfailovers.yaml
kubectl apply -f\
https://raw.githubusercontent.com/spotahome/redis-operator/master/example/operator/all-redis-operator-resources.yaml
~~~

and the apply to the cluster the [redis-cluster.yml](redis-cluster.yml) file in this directory.

This will create a replicated Redis cluster called `redis-morra`.

## Deploying morra-flask

Apply to the cluster the [`deployment-morra.yml`](deployment-morra.yml) file to create a Deployment of pods for morra-flask and [`service-morra.yml`](service-morra.yml) files to make them accessible with a `NodePort` service on port 30001 of all the nodes.

Check that everything works with `curl node2:30001`, that should return `Non c'è niente da vedere`.

# Load testing

Load test signup or login routes using [`bench_endpoints.js`](../bench_endpoints.js) by running:

~~~
export ENDPOINT=http://node2:30001/users/signup
node bench_endpoints.js
~~~

make sure you have installed Axios with `npm i axios` before doing this.