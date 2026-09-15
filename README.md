# Artea

The Artea curve is a cubic Bézier curve whose control points are constructed to minimize the curvature peak. This optimization is defined by a superellipse with $n=4/3$. The construction first normalizes the tangent geometry to right angles while preserving the ratio of the tangent lengths, performs the optimization in this normalized geometry, and then applies the affine inclination.

The Artea spline generalizes the Artea curve to a sequence of cubic Bézier segments with $G^2$ continuity. Unlike the local Artea curve, the control parameters of the individual segments are globally coupled, so the curvature remains continuous across segment boundaries. The local superellipse construction is therefore replaced by a global parameterization that preserves the same geometric principle while enforcing $G^2$ continuity.

## Cubic Bézier curve

$$
\mathbf{B}(t) =
\sum_{i=0}^{3}
\binom{3}{i}
(1-t)^{3-i} t^i \mathbf{P}_i
$$

## Artea curve

The endpoints and the tangent intersection point are given:

$$P_0,\ P_3,\ T$$

The tangent lengths are:

$$A = \lVert T-P_0\rVert,\qquad B = \lVert T-P_3\rVert$$

The control parameter is:

$$p = 1-(1-\gamma)\left(\frac{2A}{A+B}\right)^{3/4},\qquad \gamma=\frac{4(\sqrt{2}-1)}{3}$$

The inner control points are:

$$P_1=P_0+p(T-P_0),\qquad P_2=P_3+p(T-P_3)$$

## Artea spline

Each segment $k$ is a cubic Bézier curve:

$$B_k(t) = \sum_{i=0}^{3} \binom{3}{i}(1-t)^{3-i}t^i P_{k,i},\qquad 0 \leq t \leq 1$$

The endpoints and the tangent intersection point are given:

$$P_{k,0},\ P_{k,3},\ T_k$$

The tangent lengths are:

$$A_k = \lVert T_k - P_{k,0} \rVert,\qquad B_k = \lVert T_k - P_{k,3} \rVert$$

For $G^2$ continuity, define:

$$u_k = \frac{1-p_k}{p_k^2}$$

The continuity condition is:

$$u_{k+1} = u_k\frac{A_k A_{k+1}^2}{B_k^2 B_{k+1}}$$

The control parameter is given by:

$$p_k = \frac{2}{1+\sqrt{1+4u_k}}$$

Finally, the inner control points are:

$$P_{k,1} = P_{k,0} + p_k(T_k-P_{k,0}),\qquad P_{k,2} = P_{k,3} + p_k(T_k-P_{k,3})$$

---

Copyright © 2026 Johannes Krtek
