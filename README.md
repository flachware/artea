# Artea

The Artea curve is a cubic Bézier curve whose control points are constructed to minimize its curvature peak. This optimization is defined by a superellipse with $n=4/3$. The construction first normalizes the tangent geometry to right angles while preserving the ratio of the tangent lengths, performs the optimization in this normalized geometry, and then applies the affine inclination.

The Artea spline generalizes the Artea curve to a sequence of cubic Bézier segments with $G^2$ continuity. Unlike the local Artea curve, the control parameters of the individual segments are globally coupled, so the curvature remains continuous across segment boundaries. The local superellipse construction is therefore replaced by a global parameterization that preserves the same geometric principle while enforcing $G^2$ continuity.

## Cubic Bézier curve

$$
\mathbf{B}(t) = \sum_{i=0}^{3} \binom{3}{i}(1-t)^{3-i}t^i\mathbf{P}_i
$$

## Artea curve

The endpoints and the tangent intersection point are given:

$$
\mathbf{P}_0,\ \mathbf{P}_3,\ \mathbf{T}
$$

The tangent lengths are:

$$
A = \lVert\mathbf{T}-\mathbf{P}_0\rVert,\qquad B = \lVert\mathbf{T}-\mathbf{P}_3\rVert
$$

The control parameter is:

$$
p = 1-(1-\gamma)\left(\frac{2A}{A+B}\right)^{3/4},\qquad \gamma=\frac{4(\sqrt{2}-1)}{3}
$$

The inner control points are:

$$
\mathbf{P}_1=\mathbf{P}_0+p(\mathbf{T}-\mathbf{P}_0),\qquad \mathbf{P}_2=\mathbf{P}_3+p(\mathbf{T}-\mathbf{P}_3)
$$

## Artea spline

Each segment $k$ is a cubic Bézier curve:

$$
B_k(t) = \sum_{i=0}^{3} \binom{3}{i}(1-t)^{3-i}t^i\mathbf{P}_{k,i},\qquad 0\leq t\leq1
$$

The endpoints and the tangent intersection point are given:

$$
\mathbf{P}_{k,0},\ \mathbf{P}_{k,3},\ \mathbf{T}_k
$$

The tangent lengths are:

$$
A_k = \lVert\mathbf{T}_k-\mathbf{P}_{k,0}\rVert,\qquad B_k = \lVert\mathbf{T}_k-\mathbf{P}_{k,3}\rVert
$$

For $G^2$ continuity, define:

$$
u_k = \frac{1-p_k}{p_k^2}
$$

The continuity condition is:

$$
u_{k+1} = u_k\frac{A_kA_{k+1}^2}{B_k^2B_{k+1}}
$$

The control parameter is given by:

$$
p_k = \frac{2}{1+\sqrt{1+4u_k}}
$$

Finally, the inner control points are:

$$
\mathbf{P}_{k,1}=\mathbf{P}_{k,0}+p_k(\mathbf{T}_k-\mathbf{P}_{k,0}),\qquad \mathbf{P}_{k,2}=\mathbf{P}_{k,3}+p_k(\mathbf{T}_k-\mathbf{P}_{k,3})
$$

---

Copyright © 2026 Johannes Krtek
